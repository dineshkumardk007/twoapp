// Plays a live radio station (see liveStations.ts): the station's own stream,
// in an <audio> element.
//
// Not through the app's AudioContext. Routing a stream into Web Audio needs
// the station's permission (CORS), which most stations never give - without
// it the browser plays silence. A plain element plays anything.
//
// One element, kept for good. iPhones allow sound only from an element first
// started by a tap; a fresh element for every reconnect, or for following the
// partner to a new station, would be refused every time.
//
// Streams drop: the station's server restarts, the phone changes networks.
// A dropped stream is reconnected a few times, waiting longer each time,
// before the station is called off air - and comes back by itself when the
// phone is back online. A stream that simply goes quiet, without any error
// (a connection the network has silently lost), is caught by a watchdog.
//
// HLS streams (All India Radio's) are played with hls.js, loaded only when
// one is tuned. A browser's own HLS support cannot be relied on: some report
// that they can play it and then fail.

import type HlsType from 'hls.js';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';
import { LiveRadioStation } from '../types';
import { ambientAudioCoordinator } from './ambientAudioCoordinator';
import { isPlayableStreamUrl } from './liveStations';

export type LiveRadioStatus =
  | 'idle'
  /** Connecting to the station. */
  | 'tuning'
  | 'playing'
  /** Was playing; waiting for more of the stream. */
  | 'buffering'
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

class LiveRadioPlayer {
  private audio: HTMLAudioElement | null = null;
  private hls: HlsType | null = null;
  private station: LiveRadioStation | null = null;
  private volume = 0.6;
  private status: LiveRadioStatus = 'idle';
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every play, stop and reconnect, so a callback from an older one does nothing. */
  private generation = 0;
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window !== 'undefined') {
      // Back online: a station that dropped gets another go straight away.
      window.addEventListener('online', () => {
        if (!this.station || (this.status !== 'off-air' && this.status !== 'buffering')) return;
        this.attempt = 0;
        this.connect(++this.generation);
      });
    }
  }

  get current(): LiveRadioStation | null {
    return this.station;
  }

  get state(): LiveRadioStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.station);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Tunes in. Playing the station already on just carries on; one that is off
   * air, or waiting for a tap, is tried again.
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
    this.release();
    this.station = null;
    this.attempt = 0;
    this.setStatus('idle');
    if (wasOn) ambientAudioCoordinator.notifyStopped('midnight_radio');
  }

  setVolume(volume: number) {
    this.volume = clamp(volume);
    if (this.audio) this.applyVolume(this.audio);
  }

  // ---------------------------------------------------------------- inside

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
    audio.addEventListener('stalled', stalled);
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

  /** Stops whatever stream the element has, and its timers; keeps the element. */
  private release() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.clearWatchdog();
    this.hls?.destroy();
    this.hls = null;
    const audio = this.audio;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }

  private armWatchdog(gen: number, ms: number) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (gen === this.generation && this.status !== 'playing') this.retry(gen);
    }, ms);
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private async connect(gen: number) {
    const station = this.station;
    if (!station) return;
    this.release();
    this.setStatus(this.attempt === 0 ? 'tuning' : 'buffering');
    this.armWatchdog(gen, CONNECT_TIMEOUT_MS);

    const audio = this.element();
    this.applyVolume(audio);
    const live = () => gen === this.generation;

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
      this.release();
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
 * off air or stopped.
 */
export const liveRadioHold = {
  active: () => liveRadio.state === 'playing' || liveRadio.state === 'buffering' || liveRadio.state === 'tuning',
  subscribe: (onChange: () => void) => liveRadio.subscribe(() => onChange())
};
