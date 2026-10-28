import React, { useEffect, useRef, useState } from 'react';
import { BatteryCharging, Smartphone } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { useT } from '../core/i18n';
import { onShownChange } from '../core/shown';
import {
  BackgroundCard,
  BackgroundState,
  askBatteryExemption,
  backgroundAvailable,
  backgroundCardToShow,
  openOemSettings,
  readBackgroundState
} from '../core/background';

/** Set once the battery question has been answered, either way. */
export const BATTERY_ASKED_KEY = 'two_bg_battery_asked_v1';
/** Set once the brand's own settings have been pointed out, either way. */
export const OEM_SHOWN_KEY = 'two_bg_oem_shown_v1';

/** A moment after Two comes on screen, so a card does not land on an unlock or a tap. */
const SETTLE_MS = 2_000;

function seen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    // Storage unavailable: asking every time would be worse than never.
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: asked again next time */
  }
}

interface BackgroundCardsProps {
  /**
   * Whether a card may come up now: paired, unlocked, on screen, not behind
   * the disguise, no call and no other question open.
   */
  active: boolean;
}

/**
 * The two questions that keep Two connected while it is closed, each asked
 * once (core/background): to be left out of battery optimisation, and on
 * Xiaomi, vivo and OPPO phones (and their other brands), to be allowed to start
 * on its own - those close apps whatever Android says.
 *
 * Plain words first, then the phone's own screen. Two connects in the
 * background either way; these only make the phone less likely to stop it.
 */
export const BackgroundCards: React.FC<BackgroundCardsProps> = ({ active }) => {
  const t = useT();
  const [card, setCard] = useState<BackgroundCard | null>(null);
  const [oem, setOem] = useState<BackgroundState['oem']>('');

  // Each time Two comes on screen is a new visit; the brand's card waits for
  // a visit after the one the battery question was answered in.
  const visitRef = useRef(0);
  const batteryVisitRef = useRef(-1);
  useEffect(
    () =>
      onShownChange(shown => {
        if (shown) visitRef.current += 1;
      }),
    []
  );

  useEffect(() => {
    if (!active) {
      // Gone with what made it fit: a call, the screen going. It comes back
      // next time, unanswered.
      setCard(null);
      return;
    }
    if (!backgroundAvailable()) return;
    const timer = setTimeout(() => {
      // Read again each time, so a choice made in the phone's settings meanwhile counts.
      const state = readBackgroundState();
      const next = backgroundCardToShow(
        state,
        seen(BATTERY_ASKED_KEY),
        seen(OEM_SHOWN_KEY),
        batteryVisitRef.current === visitRef.current
      );
      if (next === 'mark-battery') {
        markSeen(BATTERY_ASKED_KEY);
        batteryVisitRef.current = visitRef.current;
        return;
      }
      if (next) setOem(state?.oem ?? '');
      setCard(next);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const answerBattery = (allow: boolean) => {
    markSeen(BATTERY_ASKED_KEY);
    batteryVisitRef.current = visitRef.current;
    setCard(null);
    if (allow) askBatteryExemption();
  };

  const answerOem = (open: boolean) => {
    markSeen(OEM_SHOWN_KEY);
    setCard(null);
    if (open) openOemSettings();
  };

  // The phone's Back button answers "Not now" or "Done".
  useBackLayer(card !== null, () => (card === 'battery' ? answerBattery(false) : answerOem(false)));

  if (!card) return null;

  const oemText =
    oem === 'xiaomi'
      ? t('On Xiaomi, Redmi and POCO phones, turn on Autostart for Two and set its battery saver to "No restrictions", or the phone may close it.')
      : oem === 'vivo'
      ? t('On vivo and iQOO phones, allow Two to start on its own and to run in the background, or the phone may close it.')
      : t('On OPPO, realme and OnePlus phones, allow Auto launch and Background activity for Two, or the phone may close it.');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="background-card-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl border border-linen-border bg-linen-surface p-5 text-linen-primary shadow-xl space-y-4">
        {card === 'battery' ? (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl border border-linen-border bg-linen-variant/60 p-2 text-linen-primary">
                <BatteryCharging className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h2 id="background-card-title" className="text-sm font-semibold leading-snug">
                  {t("Let Two stay connected when it's closed?")}
                </h2>
                <p className="text-xs leading-relaxed text-linen-secondary">
                  {t('Then your partner sees two ticks as soon as a message reaches you, even when Two is closed or locked.')}
                </p>
                <p className="text-xs leading-relaxed text-linen-secondary">
                  {t("Two only learns that something arrived. It can't read anything until you open it.")}
                </p>
                <p className="text-xs leading-relaxed text-linen-secondary">
                  {t('Your phone will ask to let Two run in the background. It uses a little battery and data.')}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => answerBattery(true)}
                className="w-full rounded-2xl bg-linen-primary px-4 py-3 text-sm font-semibold text-linen-surface shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
              >
                {t('Allow')}
              </button>
              <button
                type="button"
                onClick={() => answerBattery(false)}
                className="w-full py-1 text-center text-xs text-linen-secondary transition-colors hover:text-linen-primary cursor-pointer"
              >
                {t('Not now')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl border border-linen-border bg-linen-variant/60 p-2 text-linen-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <p id="background-card-title" className="min-w-0 text-sm leading-relaxed">
                {oemText}
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => answerOem(true)}
                className="w-full rounded-2xl bg-linen-primary px-4 py-3 text-sm font-semibold text-linen-surface shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
              >
                {t('Open settings')}
              </button>
              <button
                type="button"
                onClick={() => answerOem(false)}
                className="w-full py-1 text-center text-xs text-linen-secondary transition-colors hover:text-linen-primary cursor-pointer"
              >
                {t('Done')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
