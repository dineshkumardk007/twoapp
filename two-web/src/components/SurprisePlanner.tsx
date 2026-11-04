import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, Gift, ImagePlus, Trash2, X } from 'lucide-react';
import { useT } from '../core/i18n';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';
import { shrinkPhoto } from '../core/photo';
import { PHOTO_MAX_CHARS } from '../core/chatShow';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { VoiceMicButton, VoiceRecordingStrip, useVoiceRecorder } from './VoiceRecorder';
import {
  MAX_LETTER_CHARS,
  MAX_SURPRISE_PHOTOS,
  MAX_TITLE_CHARS,
  OPEN_FOR_MS,
  countdown,
  localDay,
  opensAt,
  type SurpriseBook,
  type SurpriseMedia,
  type SurprisePlan
} from '../core/surprise';
import type { Seat } from '../core/usTwo';

interface SurprisePlannerProps {
  me: Seat;
  partnerName: string;
  book: SurpriseBook;
  /** Their next birthday, from Coming up, if it is there - and how old they will be. */
  suggestedDay?: string;
  suggestedAge?: number;
  onSave: (plan: SurprisePlan, newMedia: SurpriseMedia[]) => void;
  onCancelPlan: (plan: SurprisePlan) => void;
  onPreview: (plan: SurprisePlan, media: Record<string, SurpriseMedia>) => void;
  onClose: () => void;
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Planning a surprise for the other one (core/surprise): when it opens, the
 * words on the cake, a letter, photos and a voice message. Saved, it goes to
 * their phone sealed - and this says when it is waiting there, counts down
 * to its moment, and says when it has been opened. Only on this phone: theirs
 * never shows a plan of yours.
 */
export const SurprisePlanner: React.FC<SurprisePlannerProps> = ({
  me,
  partnerName,
  book,
  suggestedDay,
  suggestedAge,
  onSave,
  onCancelPlan,
  onPreview,
  onClose
}) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const existing = book.plans.find(p => p.author === me && !p.cancelled);
  const draftId = useRef(existing?.id ?? newId('sp')).current;

  const [day, setDay] = useState(existing?.day ?? suggestedDay ?? '');
  const [time, setTime] = useState(existing?.time ?? '00:00');
  const [title, setTitle] = useState(existing?.title ?? tr('Happy Birthday, {name}! 🎂', { name: partnerName }));
  const [age, setAge] = useState(existing ? (existing.age ? String(existing.age) : '') : suggestedAge ? String(suggestedAge) : '');
  const [letter, setLetter] = useState(existing?.letter ?? '');
  const [song, setSong] = useState(existing?.song ?? true);
  const [photos, setPhotos] = useState<SurpriseMedia[]>(
    () => (existing?.photoIds ?? []).map(id => book.media[id]).filter((m): m is SurpriseMedia => !!m)
  );
  const [voice, setVoice] = useState<SurpriseMedia | null>(() => (existing?.voiceId && book.media[existing.voiceId]) || null);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [callingOff, setCallingOff] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rec = useVoiceRecorder({
    onSend: note =>
      setVoice({ id: newId('vo'), surpriseId: draftId, kind: 'voice', dataUrl: note.dataUrl, durationSeconds: note.durationSeconds, peaks: note.peaks })
  });

  const today = localDay(Date.now());
  const ageNumber = Number(age);
  const draft = (): SurprisePlan => ({
    id: draftId,
    author: me,
    day,
    time,
    title: title.trim().slice(0, MAX_TITLE_CHARS),
    letter: letter.slice(0, MAX_LETTER_CHARS),
    ...(Number.isInteger(ageNumber) && ageNumber > 0 && ageNumber < 130 ? { age: ageNumber } : {}),
    song,
    photoIds: photos.map(p => p.id),
    ...(voice ? { voiceId: voice.id } : {}),
    updatedAt: Date.now()
  });
  const mediaOf = () => Object.fromEntries([...photos, ...(voice ? [voice] : [])].map(m => [m.id, m]));

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setAdding(true);
    const room = MAX_SURPRISE_PHOTOS - photos.length;
    const added: SurpriseMedia[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const shrunk = await shrinkPhoto(file, PHOTO_MAX_CHARS);
        added.push({ id: newId('ph'), surpriseId: draftId, kind: 'photo', dataUrl: shrunk.dataUrl });
      } catch {
        /* not a photo this phone can read: skipped */
      }
    }
    setPhotos(list => [...list, ...added].slice(0, MAX_SURPRISE_PHOTOS));
    setAdding(false);
  };

  const check = (): boolean => {
    if (!day) {
      setProblem(tr('Pick the day it opens'));
      return false;
    }
    if (opensAt({ day, time }) <= Date.now()) {
      setProblem(tr('Pick a time still to come'));
      return false;
    }
    setProblem(null);
    return true;
  };

  const save = () => {
    if (!check()) return;
    haptic('confirm');
    const plan = draft();
    const fresh = Object.values(mediaOf()).filter(m => !book.media[m.id]);
    onSave(plan, fresh);
    setSaved(true);
    setTimeout(() => setSaved(false), 2_500);
  };

  // The countdown's clock, while there is one to count: until its moment,
  // or until it has been opened.
  const [now, setNow] = useState(Date.now);
  const openAt = existing ? opensAt(existing) : 0;
  const counting = !!existing && !book.seen[existing.id] && now < openAt;
  useEffect(() => {
    if (!counting) return;
    // On each second's turn, so no second is skipped or shown twice.
    const nextTurn = () => 1000 - (Date.now() % 1000) + 5;
    let timer = window.setTimeout(function tick() {
      setNow(Date.now());
      timer = window.setTimeout(tick, nextTurn());
    }, nextTurn());
    return () => window.clearTimeout(timer);
  }, [counting]);
  const left = countdown(openAt - now);

  // How it stands on their phone.
  const status = useMemo(() => {
    if (!existing) return null;
    const seenAt = book.seen[existing.id];
    if (seenAt) return { tone: 'seen', text: tr('{name} opened it · {when}', { name: partnerName, when: when(seenAt) }) };
    if (book.ready[existing.id] !== existing.updatedAt) return { tone: 'sending', text: tr('On its way to {name}’s phone…', { name: partnerName }) };
    if (now < openAt) return { tone: 'ready', text: tr('Ready and sealed on {name}’s phone.', { name: partnerName }) };
    if (now <= openAt + OPEN_FOR_MS) return { tone: 'ready', text: tr('Its moment has come: it opens as soon as {name} opens Two.', { name: partnerName }) };
    return { tone: 'sending', text: tr('No word from {name}’s phone that it was opened.', { name: partnerName }) };
  }, [existing, book, partnerName, tr, now, openAt]);

  const field = 'w-full rounded-xl border border-linen-border bg-linen-surface px-3 py-2.5 text-[14px] text-linen-primary focus:outline-hidden focus:ring-2 focus:ring-linen-accent/40';
  const label = 'mb-1.5 block text-[12px] font-semibold text-linen-primary';

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-linen-bg" role="dialog" aria-modal="true" aria-label={tr('A surprise for {name}', { name: partnerName })}>
      <div className="mx-auto max-w-xl px-4 pb-16" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2 text-linen-accent">
            <Gift className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">{tr('Surprise')}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-linen-secondary hover:bg-linen-variant" aria-label={tr('Close')}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">{tr('A surprise for {name}', { name: partnerName })}</h2>
        <p className="mt-1 text-sm leading-relaxed text-linen-secondary">
          {tr('It reaches {name}’s phone sealed - nothing shows there, not even a notice - and opens by itself at the moment you pick, with a cake to blow out, then your letter, photos and voice.', { name: partnerName })}
        </p>

        {status && (
          <p
            className={`mt-4 rounded-xl px-3 py-2.5 text-[13px] font-medium ${
              status.tone === 'sending' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {status.tone === 'seen' ? '💝 ' : status.tone === 'ready' ? '✓ ' : '⏳ '}
            {status.text}
          </p>
        )}

        {counting && (
          <div role="timer" className="mt-3 rounded-2xl border border-linen-accent/30 bg-linen-accent/10 px-4 py-3.5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              {tr('Opens on {name}’s phone in', { name: partnerName })}
            </p>
            <p className="mt-1 font-serif text-[30px] leading-tight tabular-nums text-linen-primary">
              {left.days > 0 && <span>{tr('{n} d', { n: left.days })} </span>}
              {left.clock}
            </p>
            <p className="mt-0.5 text-[12px] text-linen-secondary">{when(openAt)}</p>
          </div>
        )}

        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-linen-border bg-linen-surface/60 p-4">
            <p className={label}>{tr('When it opens on {name}’s phone', { name: partnerName })}</p>
            <div className="flex gap-2">
              <input type="date" value={day} min={today} onChange={e => setDay(e.target.value)} className={field} aria-label={tr('Day')} />
              <input type="time" value={time} onChange={e => setTime(e.target.value || '00:00')} className={`${field} max-w-[8.5rem]`} aria-label={tr('Time')} />
            </div>
            <p className="mt-1.5 text-[11px] text-linen-secondary">{tr('00:00 is midnight - the very first minute of the day.')}</p>
          </section>

          <section className="space-y-3 rounded-2xl border border-linen-border bg-linen-surface/60 p-4">
            <div>
              <label className={label} htmlFor="sp-title">{tr('Words over the cake')}</label>
              <input id="sp-title" value={title} maxLength={MAX_TITLE_CHARS} onChange={e => setTitle(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="sp-age">{tr('Age on the cake (optional)')}</label>
              <input id="sp-age" inputMode="numeric" value={age} onChange={e => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} className={`${field} max-w-[6rem]`} />
            </div>
            <label className="flex items-center justify-between gap-3 text-[13px] text-linen-primary">
              <span>{tr('Play Happy Birthday as the cake comes in')}</span>
              <input type="checkbox" checked={song} onChange={e => setSong(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--c-accent))]" />
            </label>
          </section>

          <section className="rounded-2xl border border-linen-border bg-linen-surface/60 p-4">
            <label className={label} htmlFor="sp-letter">{tr('Your letter')}</label>
            <textarea
              id="sp-letter"
              value={letter}
              maxLength={MAX_LETTER_CHARS}
              onChange={e => setLetter(e.target.value)}
              rows={7}
              placeholder={tr('Write what you want {name} to read first thing on the day…', { name: partnerName })}
              className={`${field} resize-y leading-relaxed`}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-linen-secondary">
              {letter.length} / {MAX_LETTER_CHARS}
            </p>
          </section>

          <section className="rounded-2xl border border-linen-border bg-linen-surface/60 p-4">
            <p className={label}>
              {tr('Photos')} <span className="font-normal text-linen-secondary">({photos.length} / {MAX_SURPRISE_PHOTOS})</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-linen-variant">
                  <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(list => list.filter(x => x.id !== p.id))}
                    className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
                    aria-label={tr('Remove photo')}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_SURPRISE_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={adding}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-linen-border text-[11px] font-semibold text-linen-secondary hover:bg-linen-variant/50"
                >
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  {adding ? tr('Adding…') : tr('Add')}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                void addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </section>

          <section className="rounded-2xl border border-linen-border bg-linen-surface/60 p-4">
            <p className={label}>{tr('A voice message')}</p>
            {voice ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <VoiceNotePlayer id={voice.id} audioDataUrl={voice.dataUrl} durationSeconds={voice.durationSeconds} peaks={voice.peaks} tone="composer" />
                </div>
                <button type="button" onClick={() => setVoice(null)} className="rounded-full p-2 text-linen-secondary hover:bg-linen-variant" aria-label={tr('Remove voice message')}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="relative flex min-h-[48px] items-center justify-between gap-3 rounded-xl bg-linen-variant/50 px-3">
                <span className="text-[13px] text-linen-secondary">{tr('Hold the mic and speak')}</span>
                <VoiceRecordingStrip rec={rec} className="px-3" />
                <VoiceMicButton rec={rec} />
              </div>
            )}
          </section>
        </div>

        {problem && <p className="mt-4 text-[13px] font-medium text-rose-600">{problem}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => check() && onPreview(draft(), mediaOf())}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-linen-border px-4 py-3 text-[14px] font-semibold text-linen-primary hover:bg-linen-variant"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {tr('Preview')}
          </button>
          <button
            type="button"
            onClick={save}
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-linen-primary px-4 py-3 text-[14px] font-semibold text-linen-surface hover:opacity-90"
          >
            {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : <Gift className="h-4 w-4" aria-hidden="true" />}
            {saved ? tr('Saved and sent') : existing ? tr('Save changes') : tr('Save and send')}
          </button>
        </div>

        {existing && (
          <button
            type="button"
            onClick={() => {
              if (!callingOff) {
                setCallingOff(true);
                return;
              }
              onCancelPlan(existing);
              onClose();
            }}
            className="mx-auto mt-6 block text-[12px] font-semibold text-rose-600"
          >
            {callingOff ? tr('Tap again to call it off') : tr('Call off this surprise')}
          </button>
        )}
      </div>
    </div>
  );
};
