// Web Audio API acoustic chimes and haptic feedback for Two.
// Pure client-side synthesis: zero external MP3s, instant loading, warm sound.

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    return new AudioContextClass();
  } catch {
    return null;
  }
}

/** Soft crystalline bell chime for incoming messages from partner */
export function playMessageChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Warm celestial triad: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz)
    const chords = [659.25, 830.61, 987.77];

    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.95);
    });
  } catch {}
}

/** Romantic glissando chime when receiving a Love Letter or Whisper Memo */
export function playLetterChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + idx * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 1.15);
    });
  } catch {}
}

/** Gentle heartbeat double-thump for nudges, touches & sensory pulses */
export function playHeartbeatSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 80 : 65, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {}
}

/** Tactile vibration on mobile devices (e.g. [40, 50, 40] for double tap) */
export function triggerHaptic(pattern: number | number[] = [35, 45, 35]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}
