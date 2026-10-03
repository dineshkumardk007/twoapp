// The five soundscapes: rain, fire, sea, forest, and a warm room with rain outside.
// Generated live and never repeating - see ambient/nature.ts for how each is built.

import { Session, liveContext } from './ambient/kit';
import { startPreset } from './ambient/presets';
import { ambientAudioCoordinator } from './ambientAudioCoordinator';

export type SoundscapeId = 'rain' | 'fireplace' | 'ocean' | 'forest' | 'cafe';

export interface SoundscapeMeta {
  id: SoundscapeId;
  name: string;
  tagline: string;
  emoji: string;
  description: string;
  color: string;
}

export const SOUNDSCAPES: SoundscapeMeta[] = [
  {
    id: 'rain',
    name: 'Rain on Attic Skylight',
    tagline: 'Gentle roof patter & distant rainfall',
    emoji: '🌧️',
    description: 'Rhythmic, calming rain washing against glass, soothing racing thoughts.',
    color: 'from-blue-900/40 to-indigo-950/60'
  },
  {
    id: 'fireplace',
    name: 'Cabin Fireplace',
    tagline: 'Warm amber glow & gentle timber crackle',
    emoji: '🔥',
    description: 'Subtle low-frequency hearth rumble with occasional organic wood pops.',
    color: 'from-amber-950/40 to-stone-900/60'
  },
  {
    id: 'ocean',
    name: 'Midnight Ocean Waves',
    tagline: 'Tidal ebb and flow under a starlit shore',
    emoji: '🌊',
    description: 'Slow, rhythmic wave surges synchronizing with deep, peaceful breath.',
    color: 'from-cyan-950/40 to-blue-950/60'
  },
  {
    id: 'forest',
    name: 'Pine Wind & Night Crickets',
    tagline: 'Soft canopy breeze & twilight chirp',
    emoji: '🌲',
    description: 'Whistling evergreen branches paired with distant, delicate crickets.',
    color: 'from-emerald-950/40 to-stone-900/60'
  },
  {
    id: 'cafe',
    name: 'Quiet Rainy Haven',
    tagline: 'Muffled warm indoors with continuous rain',
    emoji: '☕',
    description: 'Cozy acoustic enclosure while a gentle downpour blankets the outside world.',
    color: 'from-stone-800/40 to-neutral-900/60'
  }
];

export interface SoundscapeState {
  currentId: SoundscapeId;
  isPlaying: boolean;
  volume: number; // 0.0 to 1.0
  sleepTimerMinutes: number | null;
  secondsRemaining: number | null;
  syncedWithPartner: boolean;
}

type StateListener = (state: SoundscapeState) => void;

/**
 * The soundscape player: which of the five is playing, how loud, and the
 * sleep timer. The sound itself is built in ambient/ (see presets.ts) and
 * plays through the app's one shared audio context.
 */
class SoundscapeEngine {
  private currentId: SoundscapeId = 'rain';
  private isPlaying: boolean = false;
  private volume: number = 0.5;
  private sleepTimerMinutes: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private secondsRemaining: number | null = null;
  private syncedWithPartner: boolean = false;
  private listeners: Set<StateListener> = new Set();
  private session: Session | null = null;
  /** Which soundscape `session` is. */
  private sessionId: SoundscapeId | null = null;

  constructor() {
    // Another ambience starting (the Nightstand, the radio, a drone) stops this one.
    ambientAudioCoordinator.registerModal(() => this.pause());
  }

  /** Fades out whatever is playing and lets it take itself down. */
  private stopSession(fade = 0.8) {
    this.session?.stop(fade);
    this.session = null;
    this.sessionId = null;
  }

  public play(id?: SoundscapeId) {
    if (id) this.currentId = id;
    // Already playing this one: nothing to do. Starting it again would fade
    // it out and back in - which is what every step of a volume slider did.
    if (this.isPlaying && this.session && !this.session.isEnded && this.sessionId === this.currentId) return;
    ambientAudioCoordinator.notifyModalPlaying();
    const ctx = liveContext();
    // A soundscape changing crossfades: the old one fades out as the new one fades in.
    this.stopSession(1.2);
    if (ctx) {
      this.session = startPreset(ctx, this.currentId, this.volume, 1.8);
      this.sessionId = this.session ? this.currentId : null;
    }
    this.isPlaying = true;
    this.notify();
  }

  public pause() {
    this.stopSession();
    this.isPlaying = false;
    ambientAudioCoordinator.notifyStopped('ambient_modal');
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play(this.currentId);
    }
  }

  public selectSoundscape(id: SoundscapeId) {
    this.currentId = id;
    if (this.isPlaying) {
      this.play(id);
    } else {
      this.notify();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    this.session?.bus.setVolume(this.volume);
    this.notify();
  }

  public setSleepTimer(minutes: number | null) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    // A timer replaced or cleared mid-fade puts the volume back.
    this.session?.bus.setFade(1);

    this.sleepTimerMinutes = minutes;
    if (minutes === null || minutes <= 0) {
      this.secondsRemaining = null;
      this.notify();
      return;
    }

    this.secondsRemaining = minutes * 60;
    this.notify();

    this.timerInterval = setInterval(() => {
      if (this.secondsRemaining === null || this.secondsRemaining <= 1) {
        this.stopSleepTimerFadeOut();
      } else {
        this.secondsRemaining -= 1;
        // The last half minute fades, so sleep is not interrupted by a stop.
        if (this.secondsRemaining <= 30) this.session?.bus.setFade(this.secondsRemaining / 30);
        this.notify();
      }
    }, 1000);
  }

  private stopSleepTimerFadeOut() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.secondsRemaining = null;
    this.sleepTimerMinutes = null;
    this.pause();
    this.notify();
  }

  public setSyncedWithPartner(synced: boolean) {
    this.syncedWithPartner = synced;
    this.notify();
  }

  public getState(): SoundscapeState {
    return {
      currentId: this.currentId,
      isPlaying: this.isPlaying,
      volume: this.volume,
      sleepTimerMinutes: this.sleepTimerMinutes,
      secondsRemaining: this.secondsRemaining,
      syncedWithPartner: this.syncedWithPartner
    };
  }

  public subscribe(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }
}

export const soundscapeEngine = new SoundscapeEngine();
