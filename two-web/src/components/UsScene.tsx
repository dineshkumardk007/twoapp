import React, { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, WeatherState } from '../types';
import { Bear, Bunny, Heart, Sparkle, Zzz, Drop, type Mood } from './StickerArt';
import { wsRelay } from '../core/ws';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { boopsFor, chatDay, goodMorning, lastWordLastNight, missLevel, type Boops, type Seat } from '../core/usTwo';

/** Fired by App when the other one's boop count goes up live (BOOP). */
export const BOOPED_EVENT = 'two-booped';
/** Fired by the heart button when this phone sends a heart. */
export const HEART_SENT_EVENT = 'two-heart-sent';

interface UsSceneProps {
  activeUser: Seat;
  partnerName: string;
  partnerOnline: boolean;
  partnerTyping: boolean;
  /** When they were last seen, if they share it. */
  partnerLastSeen?: number;
  myWeather: WeatherState;
  theirWeather: WeatherState;
  messages: ChatMessage[];
  boops?: Boops;
  onBoop: () => void;
  onSendHeart: () => void;
}

const MISS_WORDS = ['All good 😌', 'A little 🙂', 'Missing you 🥺', 'A lot 😭', 'Dangerously high 🚨'];

type Part = 'night' | 'evening' | 'day';
function partOfDay(at: number): Part {
  const h = new Date(at).getHours();
  return h >= 21 || h < 6 ? 'night' : h >= 18 ? 'evening' : 'day';
}

/** A small rain cloud, for a heavy weather day. */
const RainCloud: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <g transform={`translate(${x} ${y})`} fill="#cbd5e1" stroke="#3b2723" strokeWidth={2.2}>
      <circle cx={-9} cy={2} r={8} />
      <circle cx={7} cy={3} r={7} />
      <circle cx={0} cy={-4} r={9} />
    </g>
    <Drop x={x - 7} y={y + 16} s={0.55} cls="stk-drip" />
    <Drop x={x + 6} y={y + 18} s={0.55} cls="stk-drip" delay={0.4} />
  </g>
);

/** A speech bubble over a character, pointing down at it. */
const Bubble: React.FC<{ x: number; y: number; text: string; wide?: number }> = ({ x, y, text, wide = 44 }) => (
  <g className="us-pop" transform={`translate(${x} ${y})`}>
    <rect x={-wide / 2} y={-14} width={wide} height={22} rx={11} fill="#fff" stroke="#3b2723" strokeWidth={2} />
    <path d="M-4,8 L0,14 L4,8 Z" fill="#fff" stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
    <path d="M-5,8 L5,8" stroke="#fff" strokeWidth={3} />
    <text x={0} y={2} textAnchor="middle" fontFamily="Manrope, system-ui, sans-serif" fontWeight={800} fontSize={12} fill="#3b2723">
      {text}
    </text>
  </g>
);

/**
 * Home's "Us two": a little live scene of the two of you - a bear for the
 * one who started Two, a bunny for the other, the same on both phones -
 * that shows how things are. Together when they are online, typing when
 * they are, asleep under the moon at night, a rain cloud over whoever is
 * having a heavy day, and a hug when a heart goes either way. Tapping them
 * boops them, on their phone too; tapping you makes you giggle.
 *
 * Under it: today's boop score, who said good morning first, and how much
 * you are missing each other.
 */
export const UsScene: React.FC<UsSceneProps> = ({
  activeUser,
  partnerName,
  partnerOnline,
  partnerTyping,
  partnerLastSeen,
  myWeather,
  theirWeather,
  messages,
  boops,
  onBoop,
  onSendHeart
}) => {
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Moments: a hug (a heart either way), a boop each way, a giggle. Each
  // hop has a number, so the same one again plays again, and a word over
  // the head that goes after a moment.
  const [hugUntil, setHugUntil] = useState(0);
  const [meHop, setMeHop] = useState({ n: 0, word: '', shown: false });
  const [themHop, setThemHop] = useState({ n: 0, shown: false });
  useEffect(() => {
    if (!meHop.shown) return;
    const t = setTimeout(() => setMeHop(h => ({ ...h, shown: false })), 1_600);
    return () => clearTimeout(t);
  }, [meHop.n, meHop.shown]);
  useEffect(() => {
    if (!themHop.shown) return;
    const t = setTimeout(() => setThemHop(h => ({ ...h, shown: false })), 1_600);
    return () => clearTimeout(t);
  }, [themHop.n, themHop.shown]);
  useEffect(() => {
    const hug = () => setHugUntil(Date.now() + 4_000);
    const off = wsRelay.subscribe(msg => {
      if (msg.type !== 'REMOTE_RECORD' || msg.record?.type !== 'PULSE' || msg.replay || msg.restoring) return;
      if (msg.record.authorId !== activeUser) hug();
    });
    const boopedMe = () => {
      haptic('tick');
      setMeHop(h => ({ n: h.n + 1, word: 'Boop!', shown: true }));
    };
    window.addEventListener(HEART_SENT_EVENT, hug);
    window.addEventListener(BOOPED_EVENT, boopedMe);
    return () => {
      off();
      window.removeEventListener(HEART_SENT_EVENT, hug);
      window.removeEventListener(BOOPED_EVENT, boopedMe);
    };
  }, [activeUser]);
  useEffect(() => {
    if (!hugUntil) return;
    const t = setTimeout(() => setHugUntil(0), Math.max(0, hugUntil - Date.now()));
    return () => clearTimeout(t);
  }, [hugUntil]);

  const part = partOfDay(now);
  const hugging = hugUntil > now || hugUntil > Date.now();
  const asleep =
    !partnerOnline && (part === 'night' || (!!partnerLastSeen && now - partnerLastSeen > 10 * 60 * 60 * 1000));
  const miss = useMemo(() => missLevel(messages, partnerOnline, now), [messages, partnerOnline, now]);
  const morning = useMemo(() => goodMorning(messages, now), [messages, now]);
  const lastWord = useMemo(() => lastWordLastNight(messages, now), [messages, now]);
  const score = boopsFor(boops, chatDay(now));
  const theirSeat: Seat = activeUser === 'user' ? 'partner' : 'user';
  const nameOf = (seat: Seat) => (seat === activeUser ? tr('You') : partnerName);

  // The bear is always the one who started Two, the bunny the other.
  const bearIsMe = activeUser === 'user';
  const myMood: Mood = meHop.shown
    ? meHop.word === 'hehe'
      ? 'laugh'
      : 'shock'
    : hugging
    ? 'happy'
    : miss.level >= 3
    ? 'puppy'
    : 'smile';
  const theirMood: Mood = themHop.shown
    ? 'laugh'
    : hugging
    ? 'happy'
    : asleep
    ? 'sleep'
    : partnerTyping
    ? 'grin'
    : partnerOnline
    ? 'happy'
    : 'smile';
  // Nearer each other online, nearer still in a hug.
  const gap = hugging ? 24 : partnerOnline ? 50 : 66;
  const meX = bearIsMe ? 160 - gap : 160 + gap;
  const themX = bearIsMe ? 160 + gap : 160 - gap;

  const character = (who: 'me' | 'them') => {
    const isBear = (who === 'me') === bearIsMe;
    const x = who === 'me' ? meX : themX;
    const mood = who === 'me' ? myMood : theirMood;
    const arms = hugging ? 'up' : who === 'them' && partnerTyping ? 'hold' : 'down';
    const hop = who === 'me' ? meHop.n : themHop.n;
    const Char = isBear ? Bear : Bunny;
    return (
      <g className="us-move" style={{ transform: `translateX(${x - 160}px)` }}>
        <g key={hop} className={hop ? 'us-part us-hop' : 'us-part'}>
          <g className={asleep && who === 'them' ? 'us-part' : 'us-part us-breathe'}>
            <Char x={160} y={isBear ? 90 : 98} s={isBear ? 0.8 : 0.74} mood={mood} arms={arms} />
          </g>
        </g>
      </g>
    );
  };

  const tapThem = () => {
    haptic('tick');
    setThemHop(h => ({ n: h.n + 1, shown: true }));
    onBoop();
  };
  const tapMe = () => {
    haptic('tick');
    setMeHop(h => ({ n: h.n + 1, word: 'hehe', shown: true }));
  };
  const onKey = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      run();
    }
  };

  const leader = score.user === score.partner ? null : score.user > score.partner ? 'user' : 'partner';

  return (
    <div className="space-y-3">
      <div className="us-scene relative overflow-hidden rounded-2xl" data-part={part}>
        <svg viewBox="0 0 320 170" className="block h-auto w-full" role="img" aria-label={tr('You and {name}', { name: partnerName })}>
          <defs>
            <linearGradient id="us-sky" x1="0" y1="0" x2="0" y2="1">
              {part === 'night' ? (
                <>
                  <stop offset="0" stopColor="#1b1546" />
                  <stop offset="1" stopColor="#3a2d7a" />
                </>
              ) : part === 'evening' ? (
                <>
                  <stop offset="0" stopColor="#ffb38a" />
                  <stop offset="1" stopColor="#ffd9c2" />
                </>
              ) : (
                <>
                  <stop offset="0" stopColor="#9ed8ff" />
                  <stop offset="1" stopColor="#e3f4ff" />
                </>
              )}
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={320} height={170} fill="url(#us-sky)" />
          {part === 'night' ? (
            <g>
              {[
                [24, 22], [60, 46], [96, 18], [230, 20], [262, 52], [300, 28], [140, 40]
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.6} fill="#fff" className="us-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
              ))}
              <path d="M286,18 A16,16 0 1 0 300,40 A12,12 0 1 1 286,18 Z" fill="#ffe58a" stroke="#3b2723" strokeWidth={2} />
            </g>
          ) : (
            <g>
              <circle cx={284} cy={30} r={part === 'evening' ? 15 : 13} fill={part === 'evening' ? '#ff8a5c' : '#ffd23f'} stroke="#3b2723" strokeWidth={2} />
              <g className="us-cloud" fill="#fff" opacity={0.92}>
                <ellipse cx={60} cy={30} rx={20} ry={8} />
                <ellipse cx={72} cy={24} rx={12} ry={8} />
              </g>
            </g>
          )}
          {/* The hill they sit on. */}
          <path
            d="M-10,170 L-10,140 C40,120 110,126 160,128 C220,130 280,118 330,136 L330,170 Z"
            fill={part === 'night' ? '#2c4a3a' : part === 'evening' ? '#9bc47a' : '#8fd47e'}
          />

          {/* Between them while you are both here: a little heart. */}
          {(partnerOnline || hugging) && (
            <g className="stk" data-play="true">
              <Heart x={160} y={hugging ? 44 : 60} s={hugging ? 0.9 : 0.55} cls={hugging ? 'stk-beat' : 'stk-beat'} />
              {hugging && (
                <>
                  <Heart x={128} y={40} s={0.5} cls="stk-rise" />
                  <Heart x={192} y={36} s={0.45} cls="stk-rise" delay={0.5} />
                </>
              )}
            </g>
          )}

          <g className="stk" data-play="true">
            {/* Heavy weather over whoever has it; sun-sparkles for a sunny one. */}
            {(myWeather === 'RAINY' || myWeather === 'STORMY') && <RainCloud x={meX} y={24} />}
            {(theirWeather === 'RAINY' || theirWeather === 'STORMY') && <RainCloud x={themX} y={24} />}
            {myWeather === 'SUNNY' && <Sparkle x={meX + 28} y={40} s={0.6} cls="stk-spin" />}
            {theirWeather === 'SUNNY' && <Sparkle x={themX + 28} y={40} s={0.6} cls="stk-spin" />}
            {asleep && <Zzz x={themX + 14} y={42} cls="stk-rise" />}
          </g>

          <g role="button" tabIndex={0} aria-label={tr('Boop {name}', { name: partnerName })} className="us-tap" onClick={tapThem} onKeyDown={onKey(tapThem)}>
            {character('them')}
            <rect x={themX - 34} y={30} width={68} height={120} fill="transparent" />
          </g>
          <g role="button" tabIndex={0} aria-label={tr('Giggle')} className="us-tap" onClick={tapMe} onKeyDown={onKey(tapMe)}>
            {character('me')}
            <rect x={meX - 34} y={30} width={68} height={120} fill="transparent" />
          </g>

          {themHop.shown && <Bubble key={`t${themHop.n}`} x={themX} y={34} text={tr('Boop!')} />}
          {meHop.shown && <Bubble key={`m${meHop.n}`} x={meX} y={34} text={meHop.word === 'hehe' ? 'hehe' : tr('Boop!')} />}
          {!themHop.shown && partnerTyping && !hugging && <Bubble x={themX} y={30} text="• • •" wide={40} />}
          {!themHop.shown && !partnerOnline && !asleep && !partnerTyping && <Bubble x={themX} y={30} text="…" wide={30} />}

          <g fontFamily="Manrope, system-ui, sans-serif" fontWeight={700} fontSize={11} textAnchor="middle" fill={part === 'night' ? '#fff' : '#3b2723'}>
            <text x={meX} y={164}>{tr('You')}</text>
            <text x={themX} y={164}>{partnerName.length > 12 ? partnerName.slice(0, 11) + '…' : partnerName}</text>
          </g>
        </svg>
      </div>

      {/* Today's boops. */}
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-linen-secondary">{tr('Boops today')}</span>
        <span className="tabular-nums text-linen-primary">
          {leader === activeUser && '👑 '}
          {tr('You')} <b>{score[activeUser]}</b>
          <span className="mx-1.5 text-linen-secondary">·</span>
          {leader === theirSeat && '👑 '}
          {partnerName} <b>{score[theirSeat]}</b>
        </span>
      </div>

      {/* Good morning, and the last word last night. */}
      <div className="space-y-1 text-[13px] text-linen-primary">
        <p>
          ☀️{' '}
          {morning.winner
            ? morning.streak > 1
              ? tr('{name} said good morning first · {n} days in a row', { name: nameOf(morning.winner), n: morning.streak })
              : tr('{name} said good morning first', { name: nameOf(morning.winner) })
            : tr('Nobody has said good morning yet today')}
        </p>
        {lastWord && <p>🌙 {tr('{name} had the last word last night', { name: nameOf(lastWord) })}</p>}
      </div>

      {/* How much you are missing each other. */}
      <div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-linen-secondary">{tr('Miss-you meter')}</span>
          <span className="font-medium text-linen-primary">{tr(MISS_WORDS[miss.level])}</span>
        </div>
        <div className="miss-meter mt-1.5" data-level={miss.level} aria-hidden="true">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} data-on={i <= miss.level || undefined} />
          ))}
        </div>
        {miss.level >= 2 && (
          <button
            type="button"
            onClick={() => {
              haptic('confirm');
              onSendHeart();
            }}
            className="mt-2.5 w-full rounded-xl bg-linen-variant/70 px-3 py-2 text-[13px] font-semibold text-linen-primary transition-colors hover:bg-linen-variant active:scale-[0.98]"
          >
            {tr('Send {name} a heart', { name: partnerName })} ❤️
          </button>
        )}
      </div>
    </div>
  );
};
