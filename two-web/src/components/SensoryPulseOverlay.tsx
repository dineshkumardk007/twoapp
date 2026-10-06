import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { wsRelay } from '../core/ws';
import { playSound } from '../core/sounds';
import { triggerHaptic } from '../core/audioAlerts';
import { haptic } from '../core/haptics';
import { useBackLayer } from '../core/backStack';

interface SensoryPulseOverlayProps {
  activeUser: 'user' | 'partner';
  /** The name the partner chose, so a heart says who it is from. */
  partnerName?: string;
}

/**
 * Two hearts this close together crossed on the way rather than answered each
 * other - each was sent before the other had arrived, or near enough.
 */
const SAME_MOMENT_MS = 20_000;
/** Long enough to read the card and reach "Send one back". */
const SHOW_WITH_REPLY_MS = 6_000;
/** A card with nothing to tap only needs reading. */
const SHOW_PLAIN_MS = 4_000;
/** How long the sender's own small "Sent" line stays. */
const TOAST_MS = 2_400;
/** The soft fade at the end, for the card and the line alike. */
const LEAVE_MS = 400;
/**
 * Hearts older than this when they finally arrive are history, not a moment.
 * A heart from this afternoon is still worth a quiet word on opening the app;
 * one from last week is not.
 */
const MISSED_WINDOW_MS = 12 * 60 * 60 * 1000;
/**
 * How long to wait for more of a replay before speaking for what arrived.
 *
 * The relay normally says when its replay is done, and that is what the card
 * waits for; this is only for a replay that never says so.
 */
const MISSED_SETTLE_MS = 3_000;

/** The default words, which would only repeat the headline back. */
const PLAIN_NOTE = /^thinking of you( too)?[.!]*$/i;

/**
 * What this phone knows about the hearts in flight.
 *
 * Kept outside the component because it is rendered in two places - the
 * couple's screens and a group - and moving between them remounts it. The
 * moment a heart left this phone has to survive that, or "the same moment"
 * could never be noticed across it.
 */
const moments = {
  /** When this phone last sent a heart of its own accord (not a reply). */
  sentAt: 0,
  /** When the partner's last such heart arrived here, live. */
  receivedAt: 0
};

/**
 * Hearts that arrived while nobody could see them: replayed after the app was
 * closed, or delivered live while the phone was in a pocket. They are told
 * once, quietly, as one card - never as a burst of chimes on opening.
 */
const missed = { count: 0, newest: 0, note: undefined as string | undefined };

interface Card {
  title: string;
  /** The words sent with it, when they say more than the headline. */
  note?: string;
  /** When it was sent, for a heart that was not seen as it arrived. */
  meta?: string;
  /** Offers "Send one back". */
  canReply: boolean;
  /** New for every card, so a second heart blooms again. */
  key: number;
}

function meaningfulNote(note: unknown): string | undefined {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  return trimmed && !PLAIN_NOTE.test(trimmed) ? trimmed : undefined;
}

/** "at 9:41 pm", or "yesterday at 11:40 pm" for one from before midnight. */
function sentWhen(at: number): string {
  const then = new Date(at);
  const time = then.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const now = new Date();
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000
  );
  // Nothing older than MISSED_WINDOW_MS gets here, so yesterday is as far back
  // as it goes; a day ahead is the other phone's clock, and reads as today.
  return days === 1 ? `yesterday at ${time}` : `at ${time}`;
}

/**
 * Close enough to now that "while you were away" would be wrong.
 *
 * Every reconnection replays what the socket missed, so a heart sent during a
 * few seconds without signal comes in marked as history too. It still arrives
 * quietly, as one card, but it is told as now rather than as an absence.
 */
const JUST_NOW_MS = 2 * 60 * 1000;

function pageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** The chime and the double beat under the hand - for a heart arriving now. */
function feelHeart(sameMoment: boolean) {
  playSound('gentle-chime');
  // Two heartbeats when both of you reached for it at once: the one moment
  // here that deserves to feel different from the rest.
  triggerHaptic(sameMoment ? [60, 40, 60, 180, 60, 40, 60] : [60, 40, 60]);
}

export const SensoryPulseOverlay: React.FC<SensoryPulseOverlayProps> = ({
  activeUser,
  partnerName
}) => {
  const [card, setCard] = useState<Card | null>(null);
  const [cardLeaving, setCardLeaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);

  const nameRef = useRef('Partner');
  nameRef.current = partnerName?.trim() || 'Partner';

  const cardTimers = useRef<number[]>([]);
  const toastTimers = useRef<number[]>([]);
  const settleTimer = useRef<number | undefined>(undefined);

  const clear = (timers: React.MutableRefObject<number[]>) => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(
    () => () => {
      clear(cardTimers);
      clear(toastTimers);
      window.clearTimeout(settleTimer.current);
    },
    []
  );

  const closeCard = useCallback(() => {
    clear(cardTimers);
    setCardLeaving(true);
    cardTimers.current.push(window.setTimeout(() => setCard(null), LEAVE_MS));
  }, []);

  const showCard = useCallback(
    (next: Omit<Card, 'key'>) => {
      clear(cardTimers);
      setCard({ ...next, key: Date.now() });
      setCardLeaving(false);
      cardTimers.current.push(
        window.setTimeout(closeCard, next.canReply ? SHOW_WITH_REPLY_MS : SHOW_PLAIN_MS)
      );
    },
    [closeCard]
  );

  // Back closes the card, like any other thing on top.
  useBackLayer(!!card && !cardLeaving, closeCard);

  const showToast = useCallback((text: string) => {
    clear(toastTimers);
    setToast({ text, key: Date.now() });
    setToastLeaving(false);
    toastTimers.current.push(
      window.setTimeout(() => {
        setToastLeaving(true);
        toastTimers.current.push(window.setTimeout(() => setToast(null), LEAVE_MS));
      }, TOAST_MS)
    );
  }, []);

  /**
   * Tells the hearts nobody saw arrive, once and quietly.
   *
   * No chime and no buzz: they were sent minutes or hours ago, and opening the
   * app to a volley of heartbeats for each of them read as an alarm, not a
   * kindness. Waits for the page to be looked at.
   */
  const tellMissed = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    if (!missed.count || !pageVisible()) return;
    const { count, newest, note } = missed;
    missed.count = 0;
    missed.newest = 0;
    missed.note = undefined;
    const name = nameRef.current;
    const when = sentWhen(newest);
    if (count === 1 && Date.now() - newest < JUST_NOW_MS) {
      showCard({ title: `${name} is thinking of you`, note: meaningfulNote(note), canReply: true });
      return;
    }
    showCard({
      title: `${name} thought of you`,
      note: count === 1 ? meaningfulNote(note) : undefined,
      meta: count > 1 ? `${count} times while you were away, last ${when}` : `While you were away, ${when}`,
      canReply: true
    });
  }, [showCard]);

  const holdMissed = (at: number, note: unknown) => {
    if (!at || Date.now() - at > MISSED_WINDOW_MS) return;
    missed.count += 1;
    if (at >= missed.newest) {
      missed.newest = at;
      missed.note = typeof note === 'string' ? note : undefined;
    }
  };

  /** One heart, the way this phone's person sends it. */
  const sendHeart = useCallback(
    (note?: string, opts?: { reply?: boolean }) => {
      const reply = !!opts?.reply;
      // `reply` is new; a phone still on the previous version reads the rest
      // exactly as before and shows it as an ordinary heart.
      wsRelay.broadcastUpdate('PULSE', reply ? { sender: activeUser, note, reply: true } : { sender: activeUser, note });
      haptic('confirm');

      const now = Date.now();
      const sameMoment = !reply && moments.receivedAt > 0 && now - moments.receivedAt < SAME_MOMENT_MS;
      if (sameMoment) {
        // Said once: a third heart is a conversation, not a coincidence.
        moments.receivedAt = 0;
        moments.sentAt = 0;
      } else if (reply) {
        // The heart this answers has had its answer; one more from here is
        // a conversation, not a coincidence.
        moments.receivedAt = 0;
      } else {
        moments.sentAt = now;
      }

      // Small, because the moment belongs to the person receiving it. The
      // sender used to get the same full card ("You sent a warm touch"), which
      // turned every heart into a pop-up for the one who already knew.
      showToast(sameMoment ? 'You thought of each other at the same moment' : `Sent to ${nameRef.current}`);
    },
    [activeUser, showToast]
  );

  // Hearts from the partner, live or replayed.
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe(msg => {
      // The relay has finished handing over what was missed.
      if (msg.type === 'REPLAY_COMPLETE') {
        if (!msg.more) tellMissed();
        return;
      }
      if (msg.type !== 'REMOTE_RECORD' || msg.record?.type !== 'PULSE') return;

      // Ours, coming back from another of our own devices.
      if (msg.record.authorId === activeUser) return;
      // A phone rebuilding its history, or one fetching it again after a seat
      // switch: none of it is news.
      if (msg.restoring || msg.catchUp) return;

      let parsed: { note?: unknown; reply?: unknown } = {};
      try {
        parsed = JSON.parse(msg.record.payload) || {};
      } catch (e) {
        console.error('[Pulse parse error]', e);
        return;
      }

      // History, not news: a heart sent while this app was closed. Gathered
      // into one quiet card instead of a chime per heart on opening.
      if (msg.replay) {
        holdMissed(Number(msg.record.clientTs) || 0, parsed.note);
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(tellMissed, MISSED_SETTLE_MS);
        return;
      }

      const now = Date.now();
      const reply = parsed.reply === true;
      const sameMoment = !reply && moments.sentAt > 0 && now - moments.sentAt < SAME_MOMENT_MS;
      if (sameMoment) {
        moments.sentAt = 0;
        moments.receivedAt = 0;
      } else if (reply) {
        // Ours has been answered, so it can no longer cross with anything.
        moments.sentAt = 0;
      } else {
        moments.receivedAt = now;
      }

      feelHeart(sameMoment);

      // Felt in the pocket now; the card waits until the phone is looked at,
      // or it would come and go on a screen nobody was watching.
      if (!pageVisible()) {
        holdMissed(now, parsed.note);
        return;
      }

      const name = nameRef.current;
      showCard(
        sameMoment
          ? {
              title: 'You thought of each other at the same moment',
              meta: `${name} sent a heart just as you did`,
              canReply: false
            }
          : {
              title: reply ? `${name} sent one back` : `${name} is thinking of you`,
              note: meaningfulNote(parsed.note),
              // An answer closes the loop; offering to answer it again would
              // make every heart an endless volley.
              canReply: !reply
            }
      );
    });

    return () => unsubscribe();
  }, [activeUser, showCard, tellMissed]);

  // Coming back to the phone is when anything held for it is told - and so is
  // mounting, after the lock screen or the calculator was in front.
  useEffect(() => {
    const onVisible = () => {
      if (pageVisible()) tellMissed();
    };
    onVisible();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [tellMissed]);

  // The way every heart button in the app sends: Home, the header, the
  // comfort box and the heart picker all call triggerGlobalPulse.
  useEffect(() => {
    (window as any).__triggerSensoryPulse = (note?: string) => sendHeart(note);
    return () => {
      delete (window as any).__triggerSensoryPulse;
    };
  }, [sendHeart]);

  const sendOneBack = () => {
    sendHeart('Thinking of you too', { reply: true });
    closeCard();
  };

  return (
    <>
      {card && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center px-4">
          <HeartCard key={card.key} card={card} leaving={cardLeaving} onReply={sendOneBack} onClose={closeCard} />
        </div>
      )}

      {toast && (
        <div
          className="fixed inset-x-0 z-50 pointer-events-none flex justify-center px-4"
          style={{ bottom: 'calc(max(var(--two-dock-h, 0px), env(safe-area-inset-bottom, 0px)) + 0.75rem)' }}
        >
          <Bloom key={toast.key} leaving={toastLeaving} interactive={false}>
            <div
              role="status"
              className="flex max-w-full items-center gap-1.5 rounded-full bg-linen-primary px-4 py-2 text-center text-xs font-medium text-linen-surface shadow-lg"
            >
              <Heart className="w-3.5 h-3.5 shrink-0 fill-current" aria-hidden="true" />
              <span>{toast.text}</span>
            </div>
          </Bloom>
        </div>
      )}
    </>
  );
};

/**
 * One calm bloom in, a soft fade out.
 *
 * Scale and fade over a quarter of a second, in place of three rings pinging
 * outward forever and a bouncing heart. With reduced motion asked for, only the
 * fade is left.
 */
const Bloom: React.FC<{
  leaving: boolean;
  /** False for the sender's line, which must never catch a tap meant for the screen. */
  interactive?: boolean;
  children: React.ReactNode;
}> = ({ leaving, interactive = true, children }) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Two frames, so the starting state is painted before it changes and the
    // browser has something to transition from. The timer is the floor for a
    // page that is not drawing frames: without it the card would wait,
    // invisible, in the middle of the screen.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    const floor = window.setTimeout(() => setEntered(true), 120);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(floor);
    };
  }, []);

  const shown = entered && !leaving;
  return (
    <div
      // Taps go through until it is really there, and again once it is going.
      className={`${interactive && shown ? 'pointer-events-auto' : 'pointer-events-none'} max-w-full transition-[opacity,transform] motion-reduce:transform-none ${
        leaving ? 'duration-400 ease-in' : 'duration-250 ease-out'
      } ${shown ? 'opacity-100 scale-100' : 'opacity-0 scale-[.85]'}`}
    >
      {children}
    </div>
  );
};

const HeartCard: React.FC<{
  card: Card;
  leaving: boolean;
  onReply: () => void;
  onClose: () => void;
}> = ({ card, leaving, onReply, onClose }) => (
  <Bloom leaving={leaving}>
    {/* Tapping the card puts it away; it never blocks the screen behind it. */}
    <div
      role="status"
      onClick={onClose}
      className="w-72 max-w-full rounded-3xl border border-linen-border bg-linen-surface/95 backdrop-blur-md p-6 shadow-2xl flex flex-col items-center text-center cursor-pointer"
    >
      <div className="w-14 h-14 rounded-full bg-linen-variant border border-linen-border flex items-center justify-center text-linen-accent">
        <Heart className="w-7 h-7 fill-current" aria-hidden="true" />
      </div>

      <h4 className="font-serif text-lg font-medium text-linen-primary mt-3 leading-snug">{card.title}</h4>
      {card.note && <p className="text-sm text-linen-secondary mt-1 italic">&ldquo;{card.note}&rdquo;</p>}
      {card.meta && <p className="text-xs text-linen-secondary mt-1">{card.meta}</p>}

      {card.canReply && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onReply();
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-linen-primary px-4 py-2 text-sm font-medium text-linen-surface hover:opacity-90 active:scale-[.98] transition cursor-pointer"
        >
          <Heart className="w-4 h-4 fill-current" aria-hidden="true" />
          Send one back
        </button>
      )}
    </div>
  </Bloom>
);

export const triggerGlobalPulse = (note?: string) => {
  if (typeof window !== 'undefined' && (window as any).__triggerSensoryPulse) {
    (window as any).__triggerSensoryPulse(note);
  }
};
