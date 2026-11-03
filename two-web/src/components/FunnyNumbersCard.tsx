import React, { useMemo } from 'react';
import type { ChatMessage } from '../types';
import { dateLocale, useT } from '../core/i18n';
import { clockTime } from '../core/when';
import { funnyNumbers, type Seat } from '../core/usTwo';

interface FunnyNumbersCardProps {
  messages: ChatMessage[];
  activeUser: Seat;
  partnerName: string;
}

function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** How long a reply took: "40 s", "3 min", "1 h 5 min". */
function replyTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : duration(seconds);
}

/** A 'YYYY-MM-DD' day, or a moment, as the phone writes dates. */
function dateOf(dayOrAt: string | number): string {
  let d: Date;
  if (typeof dayOrAt === 'number') d = new Date(dayOrAt);
  else {
    const [y, m, day] = dayOrAt.split('-').map(Number);
    d = new Date(y, m - 1, day);
  }
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

type Row = { icon: string; text: string };

/**
 * Our funny numbers: the chat as it is on this phone, counted - who talks
 * more and answers faster, who says good morning first and has the last
 * word at night, every "saptiya?" and "I love you" and who says them more,
 * the sweet words, the longest run of days, the chattiest hour, the busiest
 * day and the very first message. Worked out here (core/usTwo) and never
 * sent anywhere.
 */
export const FunnyNumbersCard: React.FC<FunnyNumbersCardProps> = ({ messages, activeUser, partnerName }) => {
  const tr = useT();
  // Counted again when a message comes or goes, not on every Home render.
  const last = messages[messages.length - 1];
  const n = useMemo(() => funnyNumbers(messages), [messages.length, last?.id]);
  const theirs: Seat = activeUser === 'user' ? 'partner' : 'user';
  const mine = n.messages[activeUser];
  const them = n.messages[theirs];
  if (mine + them === 0) return null;

  const fmt = (x: number) => x.toLocaleString();
  const times = (x: number) => (x === 1 ? tr('once') : tr('{n} times', { n: fmt(x) }));
  const nameOf = (seat: Seat) => (seat === activeUser ? tr('You') : partnerName);
  const champion = (rec: Record<Seat, number>) =>
    rec[activeUser] === rec[theirs] ? null : rec[activeUser] > rec[theirs] ? tr('You') : partnerName;
  const most = (rec: Record<Seat, number>) => Math.max(rec.user, rec.partner);

  // Who does it more.
  const who: Row[] = [
    {
      icon: '💬',
      text:
        mine === them
          ? tr('{n} messages each - perfectly even', { n: fmt(mine) })
          : tr('You {a} · {name} {b} - {who} talks more 😄', {
              a: fmt(mine),
              name: partnerName,
              b: fmt(them),
              who: mine > them ? tr('you') : partnerName
            })
    }
  ];
  const myReply = n.replyMs[activeUser];
  const theirReply = n.replyMs[theirs];
  if (myReply !== null && theirReply !== null && myReply !== theirReply) {
    const iAmFaster = myReply < theirReply;
    who.push({
      icon: '⚡',
      text: tr('Replies faster: {who} - usually in {fast} ({other}: {slow})', {
        who: iAmFaster ? tr('You') : partnerName,
        fast: replyTime(Math.min(myReply, theirReply)),
        other: iAmFaster ? partnerName : tr('You'),
        slow: replyTime(Math.max(myReply, theirReply))
      })
    });
  }
  const earlyBird = champion(n.firstHello);
  if (earlyBird) who.push({ icon: '☀️', text: tr('Says good morning first more: {who} ({n} days)', { who: earlyBird, n: fmt(most(n.firstHello)) }) });
  const lastWord = champion(n.lastWord);
  if (lastWord) who.push({ icon: '🌙', text: tr('Has the last word at night: {who} ({n} nights)', { who: lastWord, n: fmt(most(n.lastWord)) }) });
  if (n.saptiya) {
    const asker = champion(n.saptiyaBy);
    who.push({
      icon: '🍛',
      text: asker
        ? tr('"Saptiya?" asked {times} · {who} asks more', { times: times(n.saptiya), who: asker })
        : tr('"Saptiya?" asked {times}', { times: times(n.saptiya) })
    });
  }
  const loveYou = n.loveYou.user + n.loveYou.partner;
  if (loveYou) {
    const lover = champion(n.loveYou);
    who.push({
      icon: '💗',
      text: lover
        ? tr('"I love you" said {times} · {who} says it more', { times: times(loveYou), who: lover })
        : tr('"I love you" said {times}', { times: times(loveYou) })
    });
  }
  const misser = champion(n.missYou);
  if (misser) who.push({ icon: '🥺', text: tr('Misses the other more: {who} ({times})', { who: misser, times: times(most(n.missYou)) }) });
  const sorrier = champion(n.sorry);
  if (sorrier) who.push({ icon: '🙏', text: tr('Sorry champion: {who} ({n})', { who: sorrier, n: fmt(most(n.sorry)) }) });

  // Sweet words.
  const sweet: Row[] = [];
  if (n.hearts) sweet.push({ icon: '❤️', text: tr('{n} hearts sent between you', { n: fmt(n.hearts) }) });
  if (n.chellam) sweet.push({ icon: '🥰', text: tr('"Chellam" said {times}', { times: times(n.chellam) }) });
  if (n.kanna) sweet.push({ icon: '😍', text: tr('"Kanna" said {times}', { times: times(n.kanna) }) });
  if (n.goodNight) sweet.push({ icon: '😴', text: tr('"Good night" said {times}', { times: times(n.goodNight) }) });
  if (n.topEmoji) sweet.push({ icon: n.topEmoji.emoji, text: tr('Favourite emoji, used {times}', { times: times(n.topEmoji.count) }) });

  // Your time together.
  const time: Row[] = [];
  if (n.longestStreak >= 2) time.push({ icon: '🔥', text: tr('Longest streak: {n} days in a row', { n: fmt(n.longestStreak) }) });
  if (n.topHour !== null) time.push({ icon: '⏰', text: tr('Your chattiest hour: around {time}', { time: clockTime(new Date(2000, 0, 1, n.topHour).getTime()) }) });
  if (n.busiestDay && n.busiestDay.count > 1) {
    time.push({ icon: '📅', text: tr('Busiest day: {date} ({n} messages)', { date: dateOf(n.busiestDay.day), n: fmt(n.busiestDay.count) }) });
  }
  if (n.nightOwl) time.push({ icon: '🦉', text: tr('{n} night-owl messages after midnight', { n: fmt(n.nightOwl) }) });
  if (n.longestCallSeconds >= 60) {
    time.push({
      icon: '📞',
      text: tr('Longest call {time} · {total} talking in all', {
        time: duration(n.longestCallSeconds),
        total: duration(n.callSeconds)
      })
    });
  }
  // Only what there is: no "0 photos".
  const shared = [
    n.photos ? (n.photos === 1 ? tr('1 photo') : tr('{n} photos', { n: fmt(n.photos) })) : '',
    n.stickers ? (n.stickers === 1 ? tr('1 sticker') : tr('{n} stickers', { n: fmt(n.stickers) })) : '',
    n.voiceMinutes ? tr('{n} min of voice notes', { n: fmt(n.voiceMinutes) }) : ''
  ].filter(Boolean);
  if (shared.length) time.push({ icon: '📸', text: shared.join(' · ') });
  if (n.first) {
    const what =
      n.first.kind === 'photo'
        ? tr('a photo')
        : n.first.kind === 'voice'
          ? tr('a voice note')
          : n.first.kind === 'sticker'
            ? tr('a sticker')
            : `“${n.first.text}”`;
    time.push({ icon: '🌱', text: tr('First message here: {what} - {who}, {date}', { what, who: nameOf(n.first.who), date: dateOf(n.first.at) }) });
  }

  const section = (title: string, rows: Row[]) =>
    rows.length > 0 && (
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-linen-secondary/80">{title}</p>
        <ul className="space-y-2.5">
          {rows.map((row, i) => (
            <li key={i} className="flex items-start gap-3 text-[13px] leading-snug text-linen-primary">
              <span className="w-6 shrink-0 text-center text-base leading-5" aria-hidden="true">
                {row.icon}
              </span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 shadow-sm">
      <h3 className="font-serif text-lg font-medium text-linen-primary">{tr('Our funny numbers')}</h3>
      <p className="mt-0.5 text-[11px] text-linen-secondary">
        {tr('Since {date}, from the chat on this phone', { date: dateOf(n.since) })}
      </p>
      <div className="mt-4 space-y-5">
        {section(tr('Who does it more'), who)}
        {section(tr('Sweet words'), sweet)}
        {section(tr('Your time together'), time)}
      </div>
    </div>
  );
};
