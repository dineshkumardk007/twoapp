import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { Bear, Bunny, PartyHat } from './StickerArt';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { useT } from '../core/i18n';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';
import { getAudioContext } from '../core/audioAlerts';
import { loadSounds, playSound, type Playing } from '../core/sounds';
import { markWaitingForMic } from '../core/voice';
import type { SurpriseMedia, SurprisePlan } from '../core/surprise';

interface SurpriseRevealProps {
  plan: SurprisePlan;
  media: Record<string, SurpriseMedia>;
  /** Who planned it. */
  fromName: string;
  /** Shown to the one who planned it, to see it as it will be: nothing is marked opened. */
  preview?: boolean;
  /** The card has been reached: it counts as opened. */
  onOpened?: () => void;
  onClose: () => void;
}

type Stage = 'gift' | 'opening' | 'cake' | 'blown' | 'card';

const INK = '#3b2723';
/** The candles, across the top tier, in the cake's own units (340 × 300). */
const CANDLES = [112, 141, 170, 199, 228];
const CANDLE_TOP = 64;
/** Blowing this hard (the microphone's level)... */
const BLOW_LEVEL = 0.12;
/** ...heard this often... */
const LISTEN_EVERY_MS = 40;
/** ...for this long puts out the next candle. */
const BLOW_PER_CANDLE_MS = 170;
const CONFETTI = ['#ff6b8b', '#ffd23f', '#6cc6ff', '#8ee0a1', '#b69cff', '#ff9f43'];

/** Icing running down a tier's front: a band with drips of different lengths. */
function drips(x0: number, x1: number, top: number, depth: number, seed: number): string {
  let d = `M${x0},${top + depth} V${top + 6} Q${x0},${top} ${x0 + 12},${top} H${x1 - 12} Q${x1},${top} ${x1},${top + 6} V${top + depth}`;
  let x = x1;
  let i = seed;
  while (x > x0 + 1) {
    const w = Math.min(26, x - x0);
    const long = depth + 6 + ((i * 37) % 4) * 5;
    d += ` Q${x - w * 0.15},${top + long} ${x - w / 2},${top + long} Q${x - w * 0.85},${top + long} ${x - w},${top + depth}`;
    x -= w;
    i++;
  }
  return d + ' Z';
}

/** The cake: drawn once. Its flames are layers of their own (index.css, sr-flame). */
const Cake: React.FC<{ age?: number }> = ({ age }) => (
  <svg viewBox="0 0 340 300" className="sr-cake-art" aria-hidden="true" focusable="false">
    <ellipse cx={170} cy={276} rx={152} ry={15} fill="#eef2ff" stroke={INK} strokeWidth={3} />
    <rect x={40} y={180} width={260} height={92} rx={18} fill="#ffb3c7" stroke={INK} strokeWidth={3.5} />
    <path d={drips(40, 300, 180, 18, 1)} fill="#fff" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <rect x={84} y={112} width={172} height={72} rx={16} fill="#fff1d6" stroke={INK} strokeWidth={3.5} />
    <path d={drips(84, 256, 112, 14, 3)} fill="#ff8fb1" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    {[
      [70, 232, 20, '#6cc6ff'],
      [104, 250, -30, '#ffd23f'],
      [150, 236, 40, '#8ee0a1'],
      [196, 252, -15, '#b69cff'],
      [238, 234, 30, '#ff6b8b'],
      [272, 250, -40, '#ffd23f'],
      [112, 160, 25, '#6cc6ff'],
      [226, 162, -25, '#8ee0a1']
    ].map(([x, y, r, c], i) => (
      <rect key={i} x={(x as number) - 2.5} y={(y as number) - 6} width={5} height={12} rx={2.5} fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
    ))}
    {age ? (
      <text
        x={170}
        y={170}
        textAnchor="middle"
        fontFamily="Manrope, system-ui, sans-serif"
        fontWeight={800}
        fontSize={42}
        fill="#ff4d7d"
        stroke="#fff"
        strokeWidth={6}
        paintOrder="stroke"
      >
        {age}
      </text>
    ) : null}
    {CANDLES.map((x, i) => (
      <g key={x}>
        <rect x={x - 6} y={CANDLE_TOP} width={12} height={52} rx={4} fill="#fff" stroke={INK} strokeWidth={2.6} />
        {[0, 1, 2].map(k => (
          <path key={k} d={`M${x - 6},${CANDLE_TOP + 14 + k * 14} L${x + 6},${CANDLE_TOP + 6 + k * 14}`} stroke={CONFETTI[i % CONFETTI.length]} strokeWidth={4} />
        ))}
        <path d={`M${x},${CANDLE_TOP} V${CANDLE_TOP - 6}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    ))}
  </svg>
);

/** A burst of confetti: each bit its own layer, falling and spinning (index.css, sr-confetti). */
const ConfettiBurst: React.FC<{ count?: number }> = ({ count = 64 }) => {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 50 + (Math.random() - 0.5) * 30,
        dx: (Math.random() - 0.5) * 110,
        rise: 20 + Math.random() * 35,
        spin: (Math.random() - 0.5) * 900,
        delay: Math.random() * 0.25,
        dur: 2.4 + Math.random() * 1.6,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 9,
        round: Math.random() < 0.3,
        color: CONFETTI[i % CONFETTI.length]
      })),
    [count]
  );
  return (
    <div className="sr-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.h,
              background: b.color,
              borderRadius: b.round ? '50%' : 2,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              '--dx': `${b.dx}vw`,
              '--rise': `${b.rise}vh`,
              '--spin': `${b.spin}deg`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};

/**
 * A surprise opening (core/surprise): a gift box to tap, a cake carried in
 * to Happy Birthday, candles to blow out - into the microphone, or with a
 * tap each - confetti, and then the card: the letter, the photos and the
 * voice note. Every moving piece is a layer that only moves or fades.
 */
export const SurpriseReveal: React.FC<SurpriseRevealProps> = ({ plan, media, fromName, preview, onOpened, onClose }) => {
  const tr = useT();
  const [stage, setStage] = useState<Stage>('gift');
  const [out, setOut] = useState<boolean[]>(() => CANDLES.map(() => false));
  const [listening, setListening] = useState(false);
  const [blowing, setBlowing] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const [bursts, setBursts] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const song = useRef<Playing | null>(null);
  const stopMic = useRef<(() => void) | null>(null);
  const outRef = useRef(out);
  outRef.current = out;

  useBackLayer(true, () => (viewing ? setViewing(null) : onClose()));

  const photos = plan.photoIds.map(id => media[id]).filter((m): m is SurpriseMedia => !!m && m.kind === 'photo');
  const voice = plan.voiceId ? media[plan.voiceId] : undefined;

  const open = () => {
    if (stage !== 'gift') return;
    haptic('confirm');
    // The tap is what lets the phone play sound, so the song can start on cue.
    getAudioContext();
    playSound('unseal');
    setStage('opening');
    setTimeout(() => {
      setStage('cake');
      setBursts(n => n + 1);
      if (plan.song) song.current = playSound('birthday-song');
    }, 650);
  };

  const putOut = (i: number) => {
    if (outRef.current[i]) return;
    const next = outRef.current.map((o, k) => o || k === i);
    outRef.current = next;
    setOut(next);
    haptic('tick');
    playSound('us-shh', { rate: 2.2, gain: 0.7 });
    if (next.every(Boolean)) {
      stopMic.current?.();
      song.current?.stop();
      setTimeout(() => {
        setStage('blown');
        setBursts(n => n + 1);
        playSound('party-pop');
        haptic('confirm');
      }, 380);
    }
  };
  const putOutNext = () => {
    const i = outRef.current.findIndex(o => !o);
    if (i >= 0) putOut(i);
  };

  // Its sounds, ready before the gift is tapped.
  useEffect(() => loadSounds(['unseal', 'birthday-song', 'us-shh', 'party-pop']), []);

  /**
   * Blowing into the phone: its microphone's level, LISTEN_EVERY_MS. A breath
   * on the microphone is far louder than speech or a song from the speaker,
   * so a steady level over BLOW_LEVEL puts the candles out one after another.
   */
  const listen = async () => {
    if (listening) return;
    song.current?.stop();
    markWaitingForMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = getAudioContext();
      if (!ctx) throw new Error('no audio');
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      let held = 0;
      let last = performance.now();
      let wasBlowing = false;
      const tick = () => {
        const t = performance.now();
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const level = Math.sqrt(sum / data.length);
        const dt = Math.min(100, t - last);
        last = t;
        const now = level > BLOW_LEVEL;
        if (now !== wasBlowing) {
          wasBlowing = now;
          setBlowing(now);
        }
        held = now ? held + dt : Math.max(0, held - dt / 2);
        if (held > BLOW_PER_CANDLE_MS) {
          held = 0;
          putOutNext();
        }
      };
      const timer = setInterval(tick, LISTEN_EVERY_MS);
      stopMic.current = () => {
        clearInterval(timer);
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        stopMic.current = null;
        setListening(false);
        setBlowing(false);
      };
      setListening(true);
    } catch {
      setMicFailed(true);
    } finally {
      markWaitingForMic(false);
    }
  };

  // Once the candles are out, the card - by itself after a moment, or at once with a tap.
  useEffect(() => {
    if (stage !== 'blown') return;
    const t = setTimeout(() => setStage('card'), 2600);
    return () => clearTimeout(t);
  }, [stage]);
  useEffect(() => {
    if (stage === 'card' && !preview) onOpened?.();
    // Once, on reaching the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  useEffect(
    () => () => {
      stopMic.current?.();
      song.current?.stop();
    },
    []
  );

  const cheering = stage === 'blown' || stage === 'card';
  const character = (who: 'bear' | 'bunny') => (
    <div className={`sr-buddy sr-buddy-${who}${cheering ? ' sr-cheer' : ''}`}>
      <svg viewBox="0 0 140 160" aria-hidden="true" focusable="false">
        {who === 'bear' ? (
          <Bear x={70} y={64} mood={cheering ? 'laugh' : 'happy'} arms={cheering ? 'up' : 'hold'}>
            <PartyHat x={6} y={-26} rot={14} s={0.85} />
          </Bear>
        ) : (
          <Bunny x={70} y={70} s={0.95} mood={cheering ? 'laugh' : 'love'} arms={cheering ? 'up' : 'hold'}>
            <PartyHat x={-2} y={-26} rot={-8} s={0.8} />
          </Bunny>
        )}
      </svg>
    </div>
  );

  return (
    <div className="sr-root" data-stage={stage} role="dialog" aria-modal="true" aria-label={plan.title || tr('A surprise')}>
      <div className="sr-stars" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 60}%`, animationDelay: `${(i % 6) * 0.4}s` }} />
        ))}
      </div>

      {!preview && stage !== 'card' ? null : (
        <button type="button" className="sr-close" onClick={onClose} aria-label={tr('Close')}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {(stage === 'gift' || stage === 'opening') && (
        <div className="sr-gift-stage">
          <p className="sr-kicker">{tr('{name} left something for you', { name: fromName })}</p>
          <button type="button" className="sr-gift" onClick={open} aria-label={tr('Open it')}>
            <span className="sr-glow" aria-hidden="true" />
            <span className="sr-gift-box" aria-hidden="true">
              <svg viewBox="0 0 160 120">
                <rect x={14} y={20} width={132} height={96} rx={10} fill="#ff6b8b" stroke={INK} strokeWidth={4} />
                <rect x={70} y={20} width={20} height={96} fill="#ffd23f" stroke={INK} strokeWidth={3.5} />
                <path d="M14,46 H146" stroke={INK} strokeWidth={3} opacity={0.25} />
              </svg>
            </span>
            <span className="sr-gift-lid" aria-hidden="true">
              <svg viewBox="0 0 160 80">
                <path d="M80,40 C60,4 34,12 46,32 C52,42 70,42 80,40 Z" fill="#ffd23f" stroke={INK} strokeWidth={3.5} />
                <path d="M80,40 C100,4 126,12 114,32 C108,42 90,42 80,40 Z" fill="#ffd23f" stroke={INK} strokeWidth={3.5} />
                <rect x={6} y={40} width={148} height={30} rx={8} fill="#ff8fb1" stroke={INK} strokeWidth={4} />
                <rect x={70} y={40} width={20} height={30} fill="#ffd23f" stroke={INK} strokeWidth={3.5} />
              </svg>
            </span>
          </button>
          <p className="sr-hint">{tr('Tap to open')}</p>
        </div>
      )}

      {(stage === 'cake' || stage === 'blown' || stage === 'card') && (
        <div className="sr-cake-stage">
          <h1 className="sr-title">{plan.title || tr('Happy Birthday!')}</h1>
          <div className="sr-party">
            {character('bear')}
            <div className="sr-cake">
              <Cake age={plan.age} />
              {CANDLES.map((x, i) => (
                <button
                  key={x}
                  type="button"
                  className="sr-candle"
                  data-out={out[i] || undefined}
                  style={{ left: `${(x / 340) * 100}%`, top: `${((CANDLE_TOP - 22) / 300) * 100}%` }}
                  onClick={() => putOut(i)}
                  disabled={out[i] || stage !== 'cake'}
                  aria-label={tr('Blow out a candle')}
                >
                  <span className="sr-flame-glow" aria-hidden="true" />
                  <span className="sr-flame" style={{ animationDelay: `${-i * 0.13}s` }} aria-hidden="true" />
                  <span className="sr-smoke" aria-hidden="true" />
                </button>
              ))}
            </div>
            {character('bunny')}
          </div>

          {stage === 'cake' && (
            <div className="sr-wish">
              <p>{tr('Make a wish… then blow out the candles')}</p>
              {!micFailed ? (
                <button type="button" className="sr-blow" data-on={listening || undefined} data-blowing={blowing || undefined} onClick={listen}>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  {listening ? tr('Blow on the phone!') : tr('Blow')}
                </button>
              ) : null}
              <p className="sr-or">{micFailed ? tr('Tap the candles to blow them out') : tr('or tap the candles')}</p>
            </div>
          )}
          {stage === 'blown' && (
            <button type="button" className="sr-yay" onClick={() => setStage('card')}>
              {tr('Happy Birthday!')} 🎉
            </button>
          )}
        </div>
      )}

      {bursts > 0 && <ConfettiBurst key={bursts} count={stage === 'blown' ? 90 : 56} />}

      {stage === 'card' && (
        <div className="sr-card">
          <div className="sr-card-inner">
            <h2 className="sr-card-title">{plan.title || tr('Happy Birthday!')}</h2>
            {plan.letter && <p className="sr-letter">{plan.letter}</p>}
            {photos.length > 0 && (
              <div className="sr-photos">
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className="sr-polaroid"
                    style={{ transform: `rotate(${i % 2 ? 2.5 : -2.5}deg)` }}
                    onClick={() => setViewing(p.dataUrl)}
                  >
                    <img src={p.dataUrl} alt="" />
                  </button>
                ))}
              </div>
            )}
            {voice && voice.kind === 'voice' && (
              <div className="sr-voice">
                <p>{tr('A voice message from {name}', { name: fromName })}</p>
                <VoiceNotePlayer id={voice.id} audioDataUrl={voice.dataUrl} durationSeconds={voice.durationSeconds} peaks={voice.peaks} tone="theirs" />
              </div>
            )}
            <p className="sr-sign">— {fromName} 💝</p>
            <button type="button" className="sr-done" onClick={onClose}>
              {preview ? tr('Close preview') : tr('Close')}
            </button>
          </div>
        </div>
      )}

      {viewing && (
        <button type="button" className="sr-viewer" onClick={() => setViewing(null)} aria-label={tr('Close')}>
          <img src={viewing} alt="" />
        </button>
      )}
    </div>
  );
};
