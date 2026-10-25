import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Mic, X, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types';
import { useBackLayer } from '../core/backStack';
import { activeLocale, dateLocale, tr as trNow, useT } from '../core/i18n';
import { clockTime } from '../core/when';
import { who } from '../core/who';
import { VoiceNotePlayer } from './VoiceNotePlayer';

/** A photo the gallery can show: there, whole, and not one meant to be seen once. */
export function isGalleryPhoto(m: ChatMessage): boolean {
  return !!m.isPhoto && !!m.photoDataUrl && !m.unsent && !m.viewOnce;
}

/** A voice note the gallery can play. */
export function isGalleryVoice(m: ChatMessage): boolean {
  return !!m.isVoiceMemo && !!m.audioDataUrl && !m.unsent;
}

type Formats = { MONTH: Intl.DateTimeFormat; DAY: Intl.DateTimeFormat; TIME: Intl.DateTimeFormat };
const FORMATS = new Map<string, Formats>();

/** Months, days and times in this phone's language (en-IN in English); made once for each. */
function formats(): Formats {
  const locale = dateLocale() ?? 'en-IN';
  let made = FORMATS.get(locale);
  if (!made) {
    made = {
      MONTH: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
      DAY: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      TIME: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    };
    FORMATS.set(locale, made);
  }
  return made;
}

/** who(), with "You" and "Partner" in this phone's language; a name stays as it is. */
function whoShown(name: string): string {
  return name === 'You' || name === 'Partner' ? trNow(name) : name;
}

/** Drawn this many at a time, so a year of photos does not all decode at once. */
const PAGE = 60;

/** Newest first, in groups under a heading (a month, or a day). */
function grouped(list: ChatMessage[], label: (at: number) => string): { title: string; items: ChatMessage[] }[] {
  const groups: { title: string; items: ChatMessage[] }[] = [];
  for (const m of list) {
    const title = m.sentAt ? label(m.sentAt) : trNow('Earlier');
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(m);
    else groups.push({ title, items: [m] });
  }
  return groups;
}

interface ChatMediaSheetProps {
  messages: ChatMessage[];
  activeUser: 'user' | 'partner';
  partnerName: string;
  shareReceipts: boolean;
  onClose: () => void;
  /** Opens a photo full screen. */
  onOpenPhoto: (id: string) => void;
  /** Closes this and goes to the message in the conversation. */
  onShowInChat: (id: string) => void;
  onVoiceHeard?: (id: string) => void;
}

/**
 * Every photo and voice note the two of you have shared in the chat, in one
 * place: photos by month, voice notes by day. Only what this phone holds -
 * the newest 5,000 messages - and never a view-once photo.
 */
export const ChatMediaSheet: React.FC<ChatMediaSheetProps> = ({
  messages,
  activeUser,
  partnerName,
  shareReceipts,
  onClose,
  onOpenPhoto,
  onShowInChat,
  onVoiceHeard
}) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const { MONTH, DAY, TIME } = formats();
  const [tab, setTab] = useState<'photos' | 'voice'>('photos');
  const [shown, setShown] = useState(PAGE);

  const photos = useMemo(() => messages.filter(isGalleryPhoto).reverse(), [messages]);
  const voices = useMemo(() => messages.filter(isGalleryVoice).reverse(), [messages]);
  const list = tab === 'photos' ? photos : voices;
  const visible = list.slice(0, shown);
  const groups = useMemo(
    () => grouped(visible, at => (tab === 'photos' ? MONTH.format(at) : DAY.format(at))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible.length, tab, list, MONTH]
  );

  const switchTo = (next: 'photos' | 'voice') => {
    setTab(next);
    setShown(PAGE);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr('Photos and voice notes')}
      className="fixed inset-0 z-[75] flex flex-col bg-linen-surface surface-solid"
    >
      <div className="flex items-center gap-2 border-b border-linen-border px-3 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label={tr('Close photos and voice notes')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-linen-primary hover:bg-linen-variant"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate font-serif text-lg text-linen-primary">{tr('Photos & voice notes')}</h2>
      </div>

      <div role="tablist" className="flex gap-2 px-3 py-2">
        {(
          [
            ['photos', tr('Photos · {n}', { n: photos.length }), ImageIcon],
            ['voice', tr('Voice notes · {n}', { n: voices.length }), Mic]
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => switchTo(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === id
                ? 'border-linen-accent bg-linen-variant text-linen-primary'
                : 'border-linen-border text-linen-secondary hover:bg-linen-variant'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="tabular-nums">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-contain px-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        {list.length === 0 && (
          <p className="px-4 py-16 text-center text-sm text-linen-secondary">
            {tab === 'photos'
              ? tr('Photos you send each other in the chat will be here.')
              : tr('Voice notes you send each other in the chat will be here.')}
          </p>
        )}

        {groups.map(group => (
          <section key={group.title} className="pt-3">
            <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-linen-secondary">
              {group.title}
            </h3>
            {tab === 'photos' ? (
              <div className="grid grid-cols-3 gap-1">
                {group.items.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onOpenPhoto(m.id)}
                    aria-label={
                      m.sentAt
                        ? tr('Photo from {name}, {day}', { name: whoShown(who(m.authorId, activeUser, partnerName)), day: DAY.format(m.sentAt) })
                        : tr('Photo from {name}', { name: whoShown(who(m.authorId, activeUser, partnerName)) })
                    }
                    className="aspect-square overflow-hidden rounded-lg bg-linen-variant"
                  >
                    <img
                      src={m.photoDataUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {group.items.map(m => {
                  const mine = m.authorId === activeUser;
                  return (
                    <li key={m.id} className="rounded-2xl border border-linen-border bg-linen-surface p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-linen-secondary">
                        <span className="font-medium text-linen-primary">{whoShown(who(m.authorId, activeUser, partnerName))}</span>
                        {m.sentAt && (
                          // Intl's Tamil still says PM in English letters: the chat's own clock words instead.
                          <span className="tabular-nums">{activeLocale() === 'ta' ? clockTime(m.sentAt) : TIME.format(m.sentAt)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => onShowInChat(m.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-linen-accent hover:bg-linen-variant"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {tr('Show in chat')}
                        </button>
                      </div>
                      <VoiceNotePlayer
                        id={`media-${m.id}`}
                        audioDataUrl={m.audioDataUrl}
                        durationSeconds={m.audioDurationSeconds}
                        peaks={m.audioPeaks}
                        tone="composer"
                        heard={!!m.heard}
                        showHeard={mine ? shareReceipts : true}
                        onFirstPlay={mine ? undefined : () => onVoiceHeard?.(m.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}

        {list.length > shown && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => setShown(n => n + PAGE)}
              className="rounded-full border border-linen-border px-4 py-2 text-xs font-medium text-linen-primary hover:bg-linen-variant"
            >
              {tr('Show older')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
