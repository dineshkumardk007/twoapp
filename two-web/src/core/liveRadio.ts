// Plays a live radio station (see liveStations.ts): the station's own stream.
//
// In the Android app, a native player does the playing (RadioPlaybackService,
// through window.AndroidBridge): it keeps going with the screen off and the
// app in the background, with play and pause on the lock screen and in the
// notification, and pauses for a phone call. Elsewhere - a browser, or an
// older version of the app - an <audio> element does.
//
// Either way this decides what plays, when to try again, and when a station
// is off air; the native player reports back what it does, including what
// happens without the app (pause from the lock screen, the notification
// swiped away).
//
// The element is not routed through the app's AudioContext. Routing a stream
// into Web Audio needs the station's permission (CORS), which most stations
// never give - without it the browser plays silence. A plain element plays
// anything. And it is one element, kept for good: iPhones allow sound only
// from an element first started by a tap, so a fresh one for every reconnect
// would be refused every time.
//
// Streams drop: the station's server restarts, the phone changes networks.
// A dropped stream is reconnected a few times, waiting longer each time,
// before the station is called off air - and comes back by itself when the
// phone is back online. A stream that simply goes quiet, without any error
// (a connection the network has silently lost), is caught by a watchdog.
//
// HLS streams (All India Radio's) are played with hls.js in a browser,
// loaded only when one is tuned. A browser's own HLS support cannot be relied
// on: some report that they can play it and then fail. The native player
// plays HLS itself.

import type HlsType from 'hls.js';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';
import { LiveRadioStation } from '../types';
import { ambientAudioCoordinator } from './ambientAudioCoordinator';
import { cleanStation, isPlayableStreamUrl } from './liveStations';

export type LiveRadioStatus =
  | 'idle'
  /** Connecting to the station. */
  | 'tuning'
  | 'playing'
  /** Was playing; waiting for more of the stream. */
  | 'buffering'
  /** Paused from outside the app: the lock screen, a headset, headphones pulled out. */
  | 'paused'
  /** Could not be reached, even after retrying. */
  | 'off-air'
  /** The browser wants a tap before it will play sound (iPhones, mostly). */
  | 'needs-tap';

type Listener = (status: LiveRadioStatus, station: LiveRadioStation | null) => void;

const RETRY_DELAYS_MS = [2000, 5000, 12000];
/** How long a connection may take before it counts as failed. */
const CONNECT_TIMEOUT_MS = 25_000;
/** How long a stream may stall before it is reconnected. */
const STALL_TIMEOUT_MS = 20_000;

/** The Android app's radio, when this is the Android app (and a version that has one). */
interface NativeRadio {
  radioPlay(stationJson: string, volume: number): void;
  radioStop(): void;
  radioSetVolume(volume: number): void;
  radioSleep(atEpochMs: number): void;
  radioStatus(): string;
}

function nativeRadio(): NativeRadio | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as unknown as { AndroidBridge?: Partial<NativeRadio> }).AndroidBridge;
  return bridge && typeof bridge.radioPlay === 'function' && typeof bridge.radioStatus === 'function'
    ? (bridge as NativeRadio)
    : null;
}

/** What the native player says it is doing. */
interface NativeReport {
  event: 'idle' | 'playing' | 'buffering' | 'paused' | 'ended' | 'error' | 'stopped';
  station?: unknown;
}

let hlsModule: Promise<typeof HlsType> | null = null;
function loadHls(): Promise<typeof HlsType> {
  hlsModule ??= import('hls.js/light').then(m => m.default);
  return hlsModule;
}

/**
 * hls.js's own loader, refusing anything but a secure, public URL. A playlist
 * names the pieces to fetch, and a playlist can come from anywhere a partner
 * points the radio - so every piece is checked, not just the first address.
 */
function safeLoader(Hls: typeof HlsType) {
  const Base = Hls.DefaultConfig.loader;
  return class SafeLoader extends Base {
    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      if (!isPlayableStreamUrl(context.url)) {
        callbacks.onError({ code: 0, text: 'refused: not a secure public address' }, context, null, this.stats);
        return;
      }
      super.load(context, config, callbacks);
    }
  };
}

function subtitleOf(station: LiveRadioStation): string {
  return [station.place, station.broadcaster].filter(Boolean).join(' · ') || 'Live radio';
}

class LiveRadioPlayer {
  private readonly native = nativeRadio();
  private audio: HTMLAudioElement | null = null;
  private hls: HlsType | null = null;
  private station: LiveRadioStation | null = null;
  private volume = 0.6;
  private status: LiveRadioStatus = 'idle';
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Set while this code pauses the element itself, so that pause is not taken for the lock screen's. */
  private pausingOnPurpose = false;
  /** When the sleep timer ends the radio (epoch ms), if one is set. */
  private sleepAt: number | null = null;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every play, stop and reconnect, so a callback from an older one does nothing. */
  private generation = 0;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window === 'undefined') return;
    // Another ambience starting stops the radio, even before the radio's
    // screen has been opened (which then takes this over, to update itself).
    ambientAudioCoordinator.registerRadio(() => this.stop());
    // Back online: a station that dropped gets another go straight away.
    window.addEventListener('online', () => {
      if (!this.station || (this.status !== 'off-air' && this.status !== 'buffering')) return;
      // Android will not let a stopped radio start again from the
      // background; one called off air there waits until the app is open.
      if (this.native && this.status === 'off-air' && document.visibilityState === 'hidden') return;
      this.attempt = 0;
      this.connect(++this.generation);
    });
    if (this.native) {
      (window as unknown as { __twoRadio?: (json: string) => void }).__twoRadio = json => this.onNative(json);
      this.adoptNative();
    }
  }

  get current(): LiveRadioStation | null {
    return this.station;
  }

  get state(): LiveRadioStatus {
    return this.status;
  }

  /** When the sleep timer will end the radio, if it is set. */
  get sleepsAt(): number | null {
    return this.sleepAt;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.station);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Tunes in. Playing the station already on just carries on; one that is
   * paused, off air, or waiting for a tap, is tried again.
   */
  play(station: LiveRadioStation, volume: number) {
    this.setVolume(volume);
    if (!isPlayableStreamUrl(station.url)) {
      this.stop();
      return;
    }
    const healthy = this.status === 'tuning' || this.status === 'playing' || this.status === 'buffering';
    if (this.station?.url === station.url && healthy) {
      this.station = station;
      return;
    }
    ambientAudioCoordinator.notifyRadioPlaying();
    this.station = station;
    this.attempt = 0;
    this.connect(++this.generation);
  }

  stop() {
    const wasOn = this.status !== 'idle';
    this.generation++;
    this.release(true);
    this.setSleepAt(null);
    this.station = null;
    this.attempt = 0;
    this.setStatus('idle');
    if (wasOn) ambientAudioCoordinator.notifyStopped('midnight_radio');
  }

  setVolume(volume: number) {
    this.volume = clamp(volume);
    if (this.native) {
      if (this.status !== 'idle') this.native.radioSetVolume(this.volume);
    } else if (this.audio) {
      this.applyVolume(this.audio);
    }
  }

  /**
   * Ends the radio after this many minutes, or never (null). Kept here, not
   * in the screen, so it still ends the radio after you have left the tab -
   * and in the Android app the native player keeps it too, so it ends the
   * radio even if the page is gone.
   */
  sleepIn(minutes: number | null) {
    this.setSleepAt(minutes && minutes > 0 ? Date.now() + minutes * 60_000 : null);
  }

  // ---------------------------------------------------------------- inside

  private setSleepAt(at: number | null) {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null;
    this.sleepAt = at;
    if (at) this.sleepTimer = setTimeout(() => this.stop(), Math.max(0, at - Date.now()));
    try {
      this.native?.radioSleep(at ?? 0);
    } catch {
      /* an older bridge */
    }
  }

  private applyVolume(audio: HTMLAudioElement) {
    audio.volume = this.volume;
    // iPhones ignore volume on a media element, but do honour muted.
    audio.muted = this.volume === 0;
  }

  private setStatus(status: LiveRadioStatus) {
    if (status === this.status) return;
    this.status = status;
    for (const listener of this.listeners) listener(status, this.station);
  }

  /** The radio stopped from outside the app: the notification swiped away, the sleep timer in the service. */
  private stoppedOutside() {
    const wasOn = this.status !== 'idle';
    this.generation++;
    this.release(false);
    this.setSleepAt(null);
    this.station = null;
    this.attempt = 0;
    this.setStatus('idle');
    if (wasOn) ambientAudioCoordinator.notifyStopped('midnight_radio');
  }

  /** A page that has just loaded (after a reload, or the app reopened) picks up a station still playing. */
  private adoptNative() {
    let report: NativeReport;
    try {
      report = JSON.parse(this.native!.radioStatus());
    } catch {
      return;
    }
    const station = cleanStation(report.station);
    if (!station || !['playing', 'buffering', 'paused'].includes(report.event)) return;
    this.station = station;
    this.status = report.event === 'paused' ? 'paused' : report.event === 'playing' ? 'playing' : 'buffering';
    ambientAudioCoordinator.notifyRadioPlaying();
  }

  private onNative(json: string) {
    let report: NativeReport;
    try {
      report = JSON.parse(json);
    } catch {
      return;
    }
    const about = cleanStation(report.station);
    // Only what is about the station on now.
    if (!this.station || !about || about.url !== this.station.url) return;
    const gen = this.generation;
    switch (report.event) {
      case 'playing':
        this.clearWatchdog();
        this.attempt = 0;
        this.setStatus('playing');
        break;
      case 'buffering':
        if (this.status === 'playing') {
          this.setStatus('buffering');
          this.armWatchdog(gen, STALL_TIMEOUT_MS);
        }
        break;
      case 'paused':
        this.clearWatchdog();
        this.setStatus('paused');
        break;
      case 'error':
      case 'ended':
        if (this.status !== 'paused') this.retry(gen);
        break;
      case 'stopped':
        this.stoppedOutside();
        break;
    }
  }

  /** The one element, made on first use - which is in a tap, in the usual case. */
  private element(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => {
      if (this.status === 'idle') return;
      this.clearWatchdog();
      this.attempt = 0;
      this.setStatus('playing');
    });
    const stalled = () => {
      if (this.status !== 'playing') return;
      this.setStatus('buffering');
      this.armWatchdog(this.generation, STALL_TIMEOUT_MS);
    };
    audio.addEventListener('waiting', stalled);
    // 'stalled' only says no data has arrived for a few seconds - the element
    // may be playing on from what it has. It counts only if playback stopped.
    audio.addEventListener('stalled', () => {
      if (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) stalled();
    });
    // Playing again without a 'playing' event (it only follows a real stop):
    // back to on air, and the watchdog stands down.
    audio.addEventListener('timeupdate', () => {
      if (this.status !== 'buffering' || this.retryTimer || audio.paused) return;
      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      this.clearWatchdog();
      this.attempt = 0;
      this.setStatus('playing');
    });
    // Paused by something other than this code: the browser's own media
    // controls, the lock screen of a phone browser.
    audio.addEventListener('pause', () => {
      if (this.pausingOnPurpose || this.status !== 'playing') return;
      this.clearWatchdog();
      this.setStatus('paused');
    });
    const dropped = () => {
      // Errors from emptying the element on a stop or a reconnect are not drops.
      if (this.status !== 'idle' && audio.getAttribute('src') !== null) this.retry(this.generation);
    };
    audio.addEventListener('error', () => {
      if (!this.hls) dropped();
    });
    // A live stream that "ends" has been cut off by the station's server.
    audio.addEventListener('ended', dropped);
    this.audio = audio;
    return audio;
  }

  /**
   * Stops whatever stream is playing, and its timers. The element is kept;
   * the native player is stopped only when asked (a reconnect just hands it
   * the station again).
   */
  private release(stopNative: boolean) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.clearWatchdog();
    if (this.native) {
      if (stopNative) this.native.radioStop();
      return;
    }
    this.hls?.destroy();
    this.hls = null;
    const audio = this.audio;
    if (audio) {
      this.pausingOnPurpose = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      this.pausingOnPurpose = false;
    }
    if ('mediaSession' in navigator && stopNative) navigator.mediaSession.metadata = null;
  }

  private armWatchdog(gen: number, ms: number) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (gen === this.generation && this.status !== 'playing' && this.status !== 'paused') this.retry(gen);
    }, ms);
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private async connect(gen: number) {
    const station = this.station;
    if (!station) return;
    this.release(false);
    this.setStatus(this.attempt === 0 ? 'tuning' : 'buffering');
    this.armWatchdog(gen, CONNECT_TIMEOUT_MS);

    if (this.native) {
      try {
        this.native.radioPlay(JSON.stringify({ ...station, subtitle: subtitleOf(station) }), this.volume);
      } catch {
        this.retry(gen);
      }
      return;
    }

    const audio = this.element();
    this.applyVolume(audio);
    const live = () => gen === this.generation;
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: station.name, artist: subtitleOf(station), album: 'Midnight Radio' });
      } catch {
        /* not supported here */
      }
    }

    // play() is called before anything is awaited: when this runs from a
    // tap, that is what lets an iPhone play the element at all.
    if (!station.hls) audio.src = station.url;
    let started = audio.play();
    try {
      if (station.hls) {
        // Attaching the stream starts a new load, which cancels that first
        // play() - so, once attached, the element is asked to play again.
        // (By then the element has been allowed to play: the first call did that.)
        started.catch(() => {});
        const Hls = await loadHls();
        if (!live()) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false, loader: safeLoader(Hls) });
          this.hls = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && live()) this.retry(gen);
          });
          hls.loadSource(station.url);
          hls.attachMedia(audio);
        } else {
          // No Media Source Extensions: the browser's own HLS is the only way.
          audio.src = station.url;
        }
        started = audio.play();
      }
      await started;
    } catch (e) {
      if (!live()) return;
      const name = (e as DOMException)?.name;
      // Cut short by stop() or a newer play(): not a failure.
      if (name === 'AbortError') return;
      if (name === 'NotAllowedError') {
        // Not the station's fault: the browser wants a tap. Retrying cannot help.
        this.clearWatchdog();
        this.setStatus('needs-tap');
        return;
      }
      this.retry(gen);
    }
  }

  private retry(gen: number) {
    if (gen !== this.generation || this.retryTimer) return;
    this.clearWatchdog();
    const delay = RETRY_DELAYS_MS[this.attempt];
    if (delay === undefined) {
      this.release(true);
      this.setStatus('off-air');
      return;
    }
    this.attempt++;
    this.setStatus('buffering');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (gen === this.generation) this.connect(++this.generation);
    }, delay);
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.6));
}

export const liveRadio = new LiveRadioPlayer();

/**
 * Live radio, as something that keeps the app open (see autoLock.ts): while
 * a station is on - playing, or briefly reconnecting - but not once it is
 * paused, off air or stopped.
 */
export const liveRadioHold = {
  active: () => liveRadio.state === 'playing' || liveRadio.state === 'buffering' || liveRadio.state === 'tuning',
  subscribe: (onChange: () => void) => liveRadio.subscribe(() => onChange())
};
