// The real Two app on an Android test phone (an emulator in GitHub's CI),
// driven over adb: it makes calls and takes them, and records anything that
// crashes. Run by .github/workflows/android-call-test.yml inside the
// emulator step; everything it finds goes to $OUT (report.md, report.json,
// pictures and logs).
//
// Phone A is the app on the emulator (Dinesh). Phone B, for calls somebody
// answers, is the same web app in Chrome on the test machine (Priya). Both
// use a relay running here on port 4100.

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const PKG = 'app.two.android';
const ACTIVITY = `${PKG}/.MainActivity`;
const API = Number(process.env.API || 0);
const OUT = resolve(process.env.OUT || 'calltest-results');
const APK_DIR = resolve(process.env.APK_DIR || 'apk');
const WEB_DIST = resolve(process.env.WEB_DIST || 'web-dist');
const CODE = 'TWO-7K2M-9XQP-R4TN';
const RELAY_FOR_A = 'http://10.0.2.2:4100';
const RELAY_FOR_B = 'ws://127.0.0.1:4100/relay';

mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const say = (...a) => console.log(`[android ${API} ${stamp()}]`, ...a);

// ---------------------------------------------------------------- adb

function adb(args, { raw = false, allowFail = false, timeout = 90_000 } = {}) {
  try {
    return execFileSync('adb', args, {
      encoding: raw ? undefined : 'utf8',
      maxBuffer: 256 << 20,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    if (allowFail) return raw ? Buffer.alloc(0) : String(e.stdout || '');
    throw new Error(`adb ${args.join(' ')} failed: ${String(e.stderr || e.message).slice(0, 400)}`);
  }
}
const sh = (cmd, opts) => adb(['shell', cmd], opts);
const pidOf = () => sh(`pidof ${PKG}`, { allowFail: true }).trim();

let shotCount = 0;
function shot(name) {
  const file = `${String(++shotCount).padStart(2, '0')}-${name}.png`;
  const png = adb(['exec-out', 'screencap', '-p'], { raw: true, allowFail: true });
  if (!png.length) return null;
  writeFileSync(join(OUT, file), png);
  return file;
}

/** The screen's accessibility tree: Android's own dialogs, and the page's buttons too. */
function uiNodes() {
  sh('uiautomator dump /sdcard/ui.xml', { allowFail: true, timeout: 40_000 });
  const xml = sh('cat /sdcard/ui.xml', { allowFail: true });
  const nodes = [];
  for (const m of xml.matchAll(/<node [^>]*?\/?>/g)) {
    const tag = m[0];
    const attr = name => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1] || '';
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr('bounds'));
    nodes.push({
      text: attr('text'),
      id: attr('resource-id'),
      desc: attr('content-desc'),
      center: b ? [(+b[1] + +b[3]) >> 1, (+b[2] + +b[4]) >> 1] : null
    });
  }
  return nodes;
}
const tap = ([x, y]) => sh(`input tap ${x} ${y}`);

async function waitFor(fn, ms, what, every = 500) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(every);
  }
  throw new Error(`timed out after ${ms / 1000}s waiting for ${what}${last ? ` (${last.message})` : ''}`);
}

// ------------------------------------------------- DevTools (both phones)

async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('DevTools socket refused')), { once: true });
  });
  let seq = 0;
  const pending = new Map();
  let closed = false;
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m);
      pending.delete(m.id);
    }
  });
  ws.addEventListener('close', () => {
    closed = true;
    for (const p of pending.values()) p.reject(new Error('page went away'));
    pending.clear();
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      if (closed) return reject(new Error('page went away'));
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30_000);
    });
  await send('Runtime.enable');
  return {
    send,
    get closed() {
      return closed;
    },
    async eval(js) {
      const r = await send('Runtime.evaluate', {
        expression: `(async () => { ${js} })()`,
        awaitPromise: true,
        returnByValue: true
      });
      if (r.result?.exceptionDetails) {
        throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      }
      return r.result?.result?.value;
    },
    close() {
      try {
        ws.close();
      } catch {
        /* gone */
      }
    }
  };
}

/** The app's page inside the WebView on the emulator. */
async function appPage() {
  const pid = pidOf();
  if (!pid) throw new Error('the app is not running');
  // A debuggable app's WebView listens on this socket once it has started.
  adb(['forward', 'tcp:9333', `localabstract:webview_devtools_remote_${pid}`]);
  const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const target = list.find(t => (t.url || '').includes('appassets.androidplatform.net'));
  if (!target) throw new Error('no app page yet');
  return cdp(`ws://127.0.0.1:9333/devtools/page/${target.id}`);
}

const PAGE = {
  ready: `return !!document.querySelector('button[aria-label="All destinations"]');`,
  linked: `return !/connecting/i.test(document.body.innerText);`,
  nav: name => `
    const all = document.querySelector('button[aria-label="All destinations"]');
    if (!all) return 'no dock';
    all.click();
    await new Promise(r => setTimeout(r, 400));
    const b = [...document.querySelectorAll('.fixed.inset-0 button')].find(x => x.textContent.trim().startsWith(${JSON.stringify(name)}));
    if (!b) return 'no ' + ${JSON.stringify(name)};
    b.click();
    await new Promise(r => setTimeout(r, 1200));
    return 'ok';`,
  callScreen: `
    const d = document.querySelector('[role=dialog][aria-label^="Call with"]');
    return d ? d.innerText.replace(/\\s+/g, ' ').trim() : '';`,
  press: label => `
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!b) return 'no ' + ${JSON.stringify(label)} + ' button';
    b.click();
    return 'pressed ' + ${JSON.stringify(label)};`,
  pressCall: `
    const b = document.querySelector('button[aria-label^="Call "]');
    if (!b) return 'no Call button';
    b.click();
    return 'pressed Call';`,
  errors: `return (window.__calltestErrors || []).slice(-20);`,
  watchErrors: `
    if (!window.__calltestErrors) {
      window.__calltestErrors = [];
      window.addEventListener('error', e => window.__calltestErrors.push('error: ' + e.message));
      window.addEventListener('unhandledrejection', e => window.__calltestErrors.push('rejection: ' + (e.reason && (e.reason.message || e.reason))));
    }
    return 1;`
};

// ------------------------------------------------------------- phone A

let A = null;

/** Connects to the app's page, starting the app first if it is not running. */
async function phoneA({ fresh = false, mic = true } = {}) {
  if (fresh) {
    sh(`am force-stop ${PKG}`, { allowFail: true });
    sh(`pm clear ${PKG}`, { allowFail: true });
    if (API >= 33) sh(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`, { allowFail: true });
    sh(`pm clear-permission-flags ${PKG} android.permission.RECORD_AUDIO user-set user-fixed`, { allowFail: true });
    sh(`pm ${mic ? 'grant' : 'revoke'} ${PKG} android.permission.RECORD_AUDIO`, { allowFail: true });
  }
  if (A && !A.closed && pidOf()) return A;
  if (!pidOf()) sh(`am start -W -n ${ACTIVITY}`, { allowFail: true });
  A = await waitFor(() => appPage(), 90_000, 'the app page');
  if (fresh) {
    // Point it at the relay on this machine and pair it as Dinesh, then
    // start the page again on that.
    await A.eval(`
      AndroidBridge.setRelayUrl(${JSON.stringify(RELAY_FOR_A)});
      localStorage.setItem('two_space_session_v1', ${JSON.stringify(
        JSON.stringify({ code: CODE, role: 'user', userName: 'Dinesh', partnerName: 'Priya' })
      )});
      setTimeout(() => location.reload(), 100);
      return 1;`);
    await sleep(3000);
    A.close();
    A = await waitFor(() => appPage(), 60_000, 'the app page after pairing');
  }
  await waitFor(() => A.eval(PAGE.ready), 90_000, 'the app to open');
  await A.eval(PAGE.watchErrors);
  return A;
}

/** Back on Private Chat, with no call screen left over. */
async function onChat() {
  const a = await phoneA();
  await waitFor(async () => !(await a.eval(PAGE.callScreen)), 15_000, 'the last call screen to close');
  const nav = await a.eval(PAGE.nav('Private Chat'));
  if (nav !== 'ok') throw new Error('could not open Private Chat: ' + nav);
  return a;
}

function callService() {
  const out = sh(`dumpsys activity services ${PKG}`, { allowFail: true });
  const at = out.indexOf('CallKeepAliveService');
  if (at < 0) return { running: false, foreground: false };
  const record = out.slice(at, at + 3000);
  return { running: true, foreground: /isForeground=true/.test(record) };
}
const callNotification = () => /two_call_in_progress/.test(sh('dumpsys notification --noredact', { allowFail: true }));
function audioModeLines() {
  return sh('dumpsys audio', { allowFail: true })
    .split('\n')
    .filter(l => /MODE_IN_COMMUNICATION|MODE_NORMAL|mode owner|communication device|setCommunicationDevice/i.test(l))
    .slice(-8)
    .map(l => l.trim());
}
const proximityHeld = () => /two:call-proximity/.test(sh('dumpsys power', { allowFail: true }));

// ------------------------------------------------------------- phone B

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.wasm': 'application/wasm', '.txt': 'text/plain', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

const STUB_B = `<script>
(function(){
  window.AndroidBridge = {
    isAndroid: function(){ return true; }, haptic: function(){}, appReady: function(){},
    getRelayUrl: function(){ return ${JSON.stringify(RELAY_FOR_B)}; }, setRelayUrl: function(){},
    radioStatus: function(){ return '{}'; }, radioPlay: function(){}, radioStop: function(){}, radioSetVolume: function(){}, radioSleep: function(){},
    isHeadsetConnected: function(){ return false; },
    setCallAudio: function(){}, setCallAudioRoute: function(){}, setCallKeepAlive: function(){}, setProximityLock: function(){},
    readClipboard: function(){ return ''; }, copyText: function(){}, saveFile: function(){ return true; }, printPage: function(){},
    setBedside: function(){}, setBarsLight: function(){},
    fingerprintStatus: function(){ return 'unavailable'; }, fingerprintEnable: function(){}, fingerprintUnlock: function(){}, fingerprintDisable: function(){},
    appVersion: function(){ return JSON.stringify({ code: 1, name: '1.0.1', updatable: false }); },
    updateCheck: function(){}, updateInstall: function(){},
    earAvailable: function(){ return false; }, earWatch: function(){}, earPlay: function(){}, earStop: function(){},
    widgetUpdate: function(){}, takeLaunchAction: function(){ return ''; }
  };
  try {
    if (!localStorage.getItem('two_space_session_v1')) {
      localStorage.setItem('two_space_session_v1', ${JSON.stringify(
        JSON.stringify({ code: CODE, role: 'partner', userName: 'Priya', partnerName: 'Dinesh' })
      )});
    }
  } catch (e) {}
})();
</script>`;

let B = null;
let chrome = null;
let server = null;

async function phoneB() {
  if (B && !B.closed) return B;
  const www = join(tmpdir(), 'two-phone-b');
  rmSync(www, { recursive: true, force: true });
  cpSync(WEB_DIST, www, { recursive: true });
  const index = join(www, 'index.html');
  writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', `<head>\n${STUB_B}`));
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = join(www, path === '/' ? 'index.html' : path);
    if (!file.startsWith(www) || !existsSync(file)) file = index;
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(8963);
  chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9555',
      `--user-data-dir=${join(tmpdir(), 'two-chrome-b')}`,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      // Real addresses rather than .local names, which the emulator cannot look up.
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    { stdio: 'ignore', detached: true }
  );
  await waitFor(() => fetch('http://127.0.0.1:9555/json/version').then(r => r.ok), 30_000, 'Chrome');
  const tab = await (await fetch('http://127.0.0.1:9555/json/new?http://127.0.0.1:8963/', { method: 'PUT' })).json();
  B = await cdp(tab.webSocketDebuggerUrl);
  await B.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await waitFor(() => B.eval(PAGE.ready), 60_000, 'phone B to open');
  await B.eval(PAGE.watchErrors);
  const nav = await B.eval(PAGE.nav('Private Chat'));
  if (nav !== 'ok') throw new Error('phone B could not open Private Chat: ' + nav);
  return B;
}

async function bothLinked(a, b) {
  await waitFor(async () => (await a.eval(PAGE.linked)) && (await b.eval(PAGE.linked)), 60_000, 'both phones on the relay');
  await sleep(1500);
}

// ------------------------------------------------------------ scenarios

const scenarios = [];

async function scenario(title, fn) {
  say('▶', title);
  const r = { title, ok: true, checks: [], steps: [], shots: [], info: {} };
  r.step = (what, value) => {
    r.steps.push({ at: stamp(), what, value });
    say('  ·', what, value === undefined ? '' : JSON.stringify(value).slice(0, 200));
  };
  r.check = (name, ok, detail) => {
    r.checks.push({ name, ok: !!ok, detail });
    if (!ok) r.ok = false;
    say(ok ? '  ✓' : '  ✗', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 200));
  };
  r.shot = name => {
    const f = shot(name);
    if (f) r.shots.push(f);
  };
  adb(['logcat', '-c'], { allowFail: true });
  const pidBefore = pidOf();
  try {
    await fn(r);
  } catch (e) {
    r.ok = false;
    r.error = String(e.message || e);
    say('  ✗ stopped:', r.error);
    r.shot('stopped');
  }
  await sleep(1500);
  const pidAfter = pidOf();
  // A process that is gone, or a new one, means the app died on the way.
  const died = !pidAfter || (pidBefore && pidAfter !== pidBefore && !r.restartExpected);
  r.check('the app is still open', !died, { pidBefore, pidAfter });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const logcat = adb(['logcat', '-d', '-v', 'threadtime'], { allowFail: true });
  const pids = new Set([pidBefore, pidAfter].filter(Boolean));
  const keep = logcat
    .split('\n')
    .filter(
      line =>
        [...pids].some(p => line.includes(` ${p} `)) ||
        /AndroidRuntime|FATAL|ANR in|DEBUG\s|libc\s|chromium|cr_|WebView|ActivityManager.*two|ActivityManager.*Two|ForegroundService|startForeground|app\.two\.android/.test(line)
    )
    .join('\n');
  writeFileSync(join(OUT, `${slug}.log`), keep);
  r.log = `${slug}.log`;
  if (died) {
    r.crash = {
      crashBuffer: adb(['logcat', '-d', '-b', 'crash'], { allowFail: true }).slice(-12000),
      exitInfo: sh(`dumpsys activity exit-info ${PKG}`, { allowFail: true }).slice(0, 12000)
    };
    writeFileSync(join(OUT, `${slug}-full.log`), logcat);
    A = null;
  }
  try {
    if (A && !A.closed) r.info.pageErrors = await A.eval(PAGE.errors);
  } catch {
    /* page gone */
  }
  scenarios.push(r);
}

async function main() {
  const apk = readdirSync(APK_DIR).find(f => f.endsWith('.apk'));
  if (!apk) throw new Error('no APK in ' + APK_DIR);
  const device = {
    android: sh('getprop ro.build.version.release').trim(),
    sdk: sh('getprop ro.build.version.sdk').trim(),
    webview: (/\(([^)]*webview[^)]*)\)/i.exec(sh('dumpsys webviewupdate', { allowFail: true })) || [])[1] || '?'
  };
  say('device', device);
  say('installing', apk, adb(['install', '-r', '-t', join(APK_DIR, apk)], { timeout: 180_000 }).trim());

  // 1. The very first call on a phone: Android asks for the microphone.
  await scenario('First call while Priya is offline, allowing the microphone', async r => {
    await phoneA({ fresh: true, mic: false });
    const a = await onChat();
    r.shot('chat');
    r.step('tap Call', await a.eval(PAGE.pressCall));
    const allow = await waitFor(
      () => uiNodes().find(n => /permission_allow_foreground_only_button|permission_allow_button/.test(n.id)),
      20_000,
      "Android's microphone question"
    );
    r.shot('microphone-question');
    r.step('tap "While using the app"');
    tap(allow.center);
    await sleep(4000);
    const screen = await a.eval(PAGE.callScreen);
    r.check('the call screen says Priya is not online', /not online/i.test(screen), screen);
    const svc = callService();
    r.check('the call service runs in the foreground', svc.foreground, svc);
    r.check('the "Call in progress" notification is up', callNotification());
    r.shot('calling-offline');
    r.step('tap Cancel', await a.eval(PAGE.press('Cancel call')));
    await sleep(3000);
    r.check('the call service has stopped', !callService().running);
    r.check('the notification has gone', !callNotification());
    r.shot('cancelled');
  });

  // 2. Nobody answers: it rings for 45 seconds, then says so.
  await scenario('Call while Priya is offline rings out', async r => {
    const a = await onChat();
    r.step('tap Call', await a.eval(PAGE.pressCall));
    await sleep(3000);
    r.check('the call service runs in the foreground', callService().foreground);
    r.shot('ringing-out');
    let screen = '';
    for (let i = 0; i < 26 && !/no answer/i.test(screen); i++) {
      await sleep(2000);
      if (!pidOf()) throw new Error('the app closed while ringing');
      screen = await a.eval(PAGE.callScreen);
    }
    r.check('after 45 seconds it says No answer', /no answer/i.test(screen), screen);
    r.shot('no-answer');
    await sleep(4000);
    r.check('the call service has stopped', !callService().running);
  });

  // 3. Cancelled the instant it starts: the call service is told to stop
  // while Android may still be starting it.
  await scenario('Call cancelled straight away, ten times', async r => {
    const a = await onChat();
    for (const wait of [0, 20, 40, 60, 90, 120, 180, 250, 400, 700]) {
      const pressed = await a.eval(`
        document.querySelector('button[aria-label^="Call "]').click();
        await new Promise(r => setTimeout(r, ${wait}));
        const c = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Cancel call');
        if (c) c.click();
        return !!c;`);
      r.step(`Call, then Cancel after ${wait} ms`, pressed);
      await sleep(3500);
      if (!pidOf()) throw new Error(`the app closed (Cancel after ${wait} ms)`);
    }
    r.check('no call service left running', !callService().running);
  });

  // 4. Priya answers.
  await scenario('Call that Priya answers, with the speaker on and off', async r => {
    const b = await phoneB();
    const a = await onChat();
    await bothLinked(a, b);
    r.step('tap Call', await a.eval(PAGE.pressCall));
    await waitFor(async () => /is calling you/i.test(await b.eval(PAGE.callScreen)), 20_000, "Priya's phone to ring");
    r.step('Priya sees', await b.eval(PAGE.callScreen));
    r.step('Priya taps Accept', await b.eval(PAGE.press('Accept')));
    const live = await waitFor(async () => {
      const s = await a.eval(PAGE.callScreen);
      return /\d:\d\d/.test(s) && s;
    }, 30_000, 'the call to connect');
    r.check('the call connects', true, live);
    r.check('the call service runs in the foreground', callService().foreground);
    r.info.audioAtEar = audioModeLines();
    r.info.proximityAtEar = proximityHeld();
    r.shot('in-call');
    r.step('tap Speaker', await a.eval(PAGE.press('Use speaker')));
    await sleep(1500);
    r.info.audioOnSpeaker = audioModeLines();
    r.shot('speaker');
    r.step('tap Speaker again', await a.eval(PAGE.press('Use earpiece')));
    await sleep(3000);
    r.check('still connected after six seconds', /\d:\d\d/.test(await a.eval(PAGE.callScreen)));
    r.step('tap End', await a.eval(PAGE.press('End call')));
    await sleep(3000);
    r.step('Priya sees', await b.eval(PAGE.callScreen));
    r.check('the call service has stopped', !callService().running);
    r.check('the screen lock at the ear is let go', !proximityHeld());
    r.shot('ended');
  });

  // 5. Priya calls.
  await scenario('Priya calls and you answer', async r => {
    const b = await phoneB();
    const a = await onChat();
    await bothLinked(a, b);
    await b.eval(PAGE.nav('Private Chat'));
    r.step('Priya taps Call', await b.eval(PAGE.pressCall));
    const ring = await waitFor(async () => {
      const s = await a.eval(PAGE.callScreen);
      return /is calling you/i.test(s) && s;
    }, 20_000, 'your phone to ring');
    r.check('your phone rings', true, ring);
    r.shot('ringing-in');
    r.step('tap Accept', await a.eval(PAGE.press('Accept')));
    await waitFor(async () => /\d:\d\d/.test(await a.eval(PAGE.callScreen)), 30_000, 'the call to connect');
    r.check('the call service runs in the foreground', callService().foreground);
    r.shot('answered');
    await sleep(4000);
    r.step('Priya taps End', await b.eval(PAGE.press('End call')));
    await sleep(3000);
    r.step('you see', await a.eval(PAGE.callScreen));
    r.check('the call service has stopped', !callService().running);
  });

  // 6. The screen goes off mid-call: the call carries on.
  await scenario('Screen turned off in the middle of a call', async r => {
    const b = await phoneB();
    const a = await onChat();
    await bothLinked(a, b);
    r.step('tap Call', await a.eval(PAGE.pressCall));
    await waitFor(async () => /is calling you/i.test(await b.eval(PAGE.callScreen)), 20_000, "Priya's phone to ring");
    await b.eval(PAGE.press('Accept'));
    await waitFor(async () => /\d:\d\d/.test(await a.eval(PAGE.callScreen)), 30_000, 'the call to connect');
    r.step('press the power button');
    sh('input keyevent KEYCODE_SLEEP');
    await sleep(10_000);
    r.check('the app is still running with the screen off', !!pidOf());
    r.check('the call is still on (Priya sees a timer)', /\d:\d\d/.test(await b.eval(PAGE.callScreen)));
    r.check('the call service still runs in the foreground', callService().foreground);
    sh('input keyevent KEYCODE_WAKEUP');
    sh('wm dismiss-keyguard', { allowFail: true });
    await sleep(2000);
    r.shot('back-on');
    r.step('tap End', await a.eval(PAGE.press('End call')));
    await sleep(3000);
    r.check('the call service has stopped', !callService().running);
  });

  // 7. The microphone refused.
  await scenario("Call when you don't allow the microphone", async r => {
    r.restartExpected = true;
    // Taking a permission away stops the app, as Android always does.
    sh(`pm revoke ${PKG} android.permission.RECORD_AUDIO`, { allowFail: true });
    sh(`pm clear-permission-flags ${PKG} android.permission.RECORD_AUDIO user-set user-fixed`, { allowFail: true });
    await sleep(1500);
    A = null;
    const a = await onChat();
    r.step('tap Call', await a.eval(PAGE.pressCall));
    const deny = await waitFor(
      () => uiNodes().find(n => /permission_deny_button/.test(n.id)),
      20_000,
      "Android's microphone question"
    );
    r.step("tap Don't allow");
    tap(deny.center);
    await sleep(3000);
    const screen = await a.eval(PAGE.callScreen);
    r.check('the call screen says the microphone is not allowed', /microphone/i.test(screen), screen);
    r.check('no call service started', !callService().running);
    r.shot('mic-refused');
  });

  return device;
}

// ------------------------------------------------------------ the report

let device = {};
try {
  device = await main();
} catch (e) {
  say('stopped early:', e.message);
  scenarios.push({ title: 'Setting up the test phone', ok: false, error: String(e.message || e), checks: [], steps: [], shots: [] });
}

const failed = scenarios.filter(s => !s.ok);
const summary = {
  api: API,
  device,
  passed: scenarios.length - failed.length,
  failed: failed.length,
  crashed: scenarios.filter(s => s.crash).map(s => s.title),
  scenarios: scenarios.map(s => ({
    title: s.title,
    ok: s.ok,
    crashed: !!s.crash,
    error: s.error,
    failedChecks: s.checks.filter(c => !c.ok).map(c => c.name)
  }))
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ device, scenarios }, null, 2));

const md = [`# Calls on Android ${device.android || '?'} (API ${API})`, '', `WebView: ${device.webview || '?'}`, ''];
for (const s of scenarios) {
  md.push(`## ${s.ok ? 'PASS' : 'FAIL'} - ${s.title}`, '');
  if (s.error) md.push(`Stopped: \`${s.error}\``, '');
  for (const c of s.checks) md.push(`- ${c.ok ? 'ok ' : 'NO '} ${c.name}${c.detail !== undefined ? ` - \`${JSON.stringify(c.detail).slice(0, 300)}\`` : ''}`);
  if (s.steps.length) {
    md.push('', '<details><summary>Steps</summary>', '');
    for (const st of s.steps) md.push(`- ${st.at} ${st.what}${st.value !== undefined ? ` - \`${JSON.stringify(st.value).slice(0, 300)}\`` : ''}`);
    md.push('', '</details>');
  }
  if (Object.keys(s.info || {}).length) md.push('', '```', JSON.stringify(s.info, null, 2).slice(0, 3000), '```');
  if (s.crash) {
    md.push('', '### Crash', '', '```', s.crash.crashBuffer.slice(-6000) || '(crash buffer empty)', '```');
    md.push('', '```', s.crash.exitInfo.slice(0, 6000), '```');
  }
  if (s.shots.length) md.push('', s.shots.map(f => `![${f}](${f})`).join(' '));
  if (s.log) md.push('', `Log: [${s.log}](${s.log})`);
  md.push('');
}
writeFileSync(join(OUT, 'report.md'), md.join('\n'));
say(`done: ${summary.passed} passed, ${summary.failed} failed`);

try {
  A?.close();
  B?.close();
  server?.close();
  if (chrome) process.kill(-chrome.pid);
} catch {
  /* the job ends anyway */
}
process.exit(0);
