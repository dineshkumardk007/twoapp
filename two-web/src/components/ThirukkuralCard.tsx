import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Send, Check } from 'lucide-react';
import { getKural, kuralNumberFor, Kural, KURAL_COUNT } from '../data/thirukkural';
import { localDateKey } from '../core/ourDates';

interface ThirukkuralCardProps {
  /** Puts the kural in the chat, as an ordinary message. */
  onShare?: (text: string) => void;
}

/**
 * The kural of the day, cut into a palm leaf.
 *
 * Both phones show the same one: the whole Thirukkural in order, a kural a
 * day (data/thirukkural). Underneath, Pope's verse translation and the plain
 * meaning. The letter button swaps the Tamil on the leaf for its
 * transliteration, for whoever reads Tamil more easily in Latin letters.
 */
export const ThirukkuralCard: React.FC<ThirukkuralCardProps> = ({ onShare }) => {
  const number = kuralNumberFor(localDateKey());
  const [kural, setKural] = useState<Kural | null>(null);
  const [latin, setLatin] = useState(false);
  const [shared, setShared] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  // Two lines, never three: shrink the letters until the longer line fits.
  // Measured again once the leaf's own font has arrived (it swaps in after
  // the first paint), and when the screen changes width.
  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const fit = () => {
      text.style.setProperty('--olai-fit', '1');
      const lines = [...text.querySelectorAll<HTMLElement>('.olai-line')];
      const widest = Math.max(0, ...lines.map(line => line.scrollWidth));
      const room = text.clientWidth;
      if (widest > room && room > 0) {
        text.style.setProperty('--olai-fit', String(Math.max(0.6, Math.floor((room / widest) * 100) / 100)));
      }
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => live && fit());
    window.addEventListener('resize', fit);
    return () => {
      live = false;
      window.removeEventListener('resize', fit);
    };
  }, [kural, latin]);

  useEffect(() => {
    let live = true;
    getKural(number)
      .then(k => {
        if (live) setKural(k);
      })
      .catch(() => {
        /* the card simply stays away */
      });
    return () => {
      live = false;
    };
  }, [number]);

  if (!kural) {
    // The same height the card will have, so Home does not jump when the
    // book arrives a moment later.
    return <div aria-hidden="true" className="h-[290px] rounded-3xl border border-linen-border bg-linen-surface/60" />;
  }

  const share = () => {
    if (!onShare) return;
    onShare(
      `Today's kural (${kural.number}):\n${kural.line1}\n${kural.line2}\n\n${kural.pope}`
    );
    setShared(true);
    window.setTimeout(() => setShared(false), 2500);
  };

  return (
    <section
      aria-label="Thirukkural of the day"
      className="rounded-3xl border border-linen-border bg-linen-surface p-5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-aurora-gold">
          Thirukkural · Kural of the day
        </p>
        <button
          type="button"
          onClick={() => setLatin(v => !v)}
          aria-pressed={latin}
          aria-label={latin ? 'Show in Tamil script' : 'Show in English letters'}
          className="tap-target-icon grid h-7 min-w-[28px] place-items-center rounded-lg border border-linen-border bg-linen-variant/50 px-1.5 text-xs font-semibold text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
        >
          {latin ? 'அ' : 'A'}
        </button>
      </div>

      <figure className="mt-4 -mx-2">
        <div className="olai" lang={latin ? 'ta-Latn' : 'ta'}>
          <span aria-hidden="true" className="olai-hole olai-hole-left" />
          <span aria-hidden="true" className="olai-hole olai-hole-right" />
          <svg aria-hidden="true" className="olai-cord" viewBox="0 0 22 46">
            <path d="M6 4 C 3 14, 4 26, 8 36" fill="none" stroke="#a42a22" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M6 4 C 10 14, 14 24, 12 42" fill="none" stroke="#c0392b" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="6" cy="7" r="2.2" fill="#8f231c" />
          </svg>
          <p ref={textRef} className={`olai-text select-text ${latin ? 'is-latin' : ''}`}>
            <span className="olai-line">{latin ? kural.translit1 : kural.line1}</span>
            <span className="olai-line">{latin ? kural.translit2 : kural.line2}</span>
          </p>
        </div>
        <figcaption className="mt-3 px-2 text-[11px] leading-relaxed text-linen-secondary">
          Kural {kural.number} of {KURAL_COUNT.toLocaleString('en-IN')} · {kural.chapter.tamil} ·{' '}
          {kural.chapter.english}
        </figcaption>
      </figure>

      <p className="mt-3 select-text font-serif text-[15px] italic leading-relaxed text-linen-primary">
        {kural.pope}
      </p>
      <p className="mt-2 select-text text-xs leading-relaxed text-linen-secondary">
        <span className="font-semibold text-linen-primary">Meaning: </span>
        {kural.meaning}
      </p>

      <div className="mt-4 flex items-center justify-end gap-3">
        {onShare && (
          <button
            type="button"
            onClick={share}
            disabled={shared}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-linen-border bg-linen-variant/50 px-3 py-1.5 text-xs font-medium text-linen-primary hover:bg-linen-variant disabled:opacity-80 transition-colors cursor-pointer"
          >
            {shared ? <Check className="h-3.5 w-3.5 text-aurora-teal" /> : <Send className="h-3.5 w-3.5 text-linen-accent" />}
            {shared ? 'Sent' : 'Send to chat'}
          </button>
        )}
      </div>
    </section>
  );
};
