import React, { useMemo } from 'react';
import type { ChatMessage } from '../types';
import { useT } from '../core/i18n';
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

/**
 * Our funny numbers: the chat as it is on this phone, counted - who talks
 * more, the hearts, every "saptiya?", who misses whom and who says sorry,
 * the night-owl chats after midnight, the longest call, the favourite emoji.
 * Worked out here (core/usTwo) and never sent anywhere.
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
  const champion = (rec: Record<Seat, number>) =>
    rec[activeUser] === rec[theirs] ? null : rec[activeUser] > rec[theirs] ? tr('You') : partnerName;

  const rows: { icon: string; text: string }[] = [
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
  if (n.hearts) rows.push({ icon: '❤️', text: tr('{n} hearts sent between you', { n: fmt(n.hearts) }) });
  if (n.saptiya) rows.push({ icon: '🍛', text: tr('"Saptiya?" asked {times}', { times: times(n.saptiya) }) });
  const misser = champion(n.missYou);
  if (misser) {
    rows.push({
      icon: '🥺',
      text: tr('Misses the other more: {who} ({times})', { who: misser, times: times(Math.max(n.missYou.user, n.missYou.partner)) })
    });
  }
  const sorrier = champion(n.sorry);
  if (sorrier) {
    rows.push({
      icon: '🙏',
      text: tr('Sorry champion: {who} ({n})', { who: sorrier, n: fmt(Math.max(n.sorry.user, n.sorry.partner)) })
    });
  }
  if (n.nightOwl) rows.push({ icon: '🦉', text: tr('{n} night-owl messages after midnight', { n: fmt(n.nightOwl) }) });
  if (n.longestCallSeconds >= 60) {
    rows.push({
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
  if (shared.length) rows.push({ icon: '📸', text: shared.join(' · ') });
  if (n.topEmoji) rows.push({ icon: n.topEmoji.emoji, text: tr('Favourite emoji, used {times}', { times: times(n.topEmoji.count) }) });

  return (
    <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 shadow-sm">
      <h3 className="font-serif text-lg font-medium text-linen-primary">{tr('Our funny numbers')}</h3>
      <p className="mt-0.5 text-[11px] text-linen-secondary">
        {tr('Since {date}, from the chat on this phone', {
          date: new Date(n.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        })}
      </p>
      <ul className="mt-3.5 space-y-2.5">
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
};
