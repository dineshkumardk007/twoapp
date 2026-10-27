import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageSquare, Mail, X, ArrowRight, Heart } from 'lucide-react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import {
  SPEED_WINDOW_MS,
  liftSpeed,
  swipeAxis,
  swipeFade,
  swipeOffset,
  swipePast,
  swipeVerdict,
  type SwipeAxis,
  type SwipeSample,
  type ToastExit
} from '../core/toastSwipe';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'chat' | 'letter' | 'touch' | 'general';
  tabId: string;
}

interface InAppNotificationToastProps {
  notification: InAppNotification | null;
  /** Something full-screen covers it - the call screen - so its time stands still, and starts over once that goes. */
  held?: boolean;
  onDismiss: () => void;
  onOpenTab: (tabId: string) => void;
}

/** On screen this long, a notice goes by itself: counted only while Two is in front of you and nothing holds it. */
const SHOW_MS = 3000;
/** A notice that something went wrong - a photo too large, a problem - stays this long instead. */
const NOTICE_MS = 8000;
/** How long it takes to go: off the way it was sent, or with reduced motion a fade where it is. */
const LEAVE_MS = 220;
/** Let go short of the line, it springs back this quickly. */
const SETTLE_MS = 180;
/** A click this soon after a drag ended belongs to the drag, not to the notice under it. */
const SWALLOW_MS = 400;
/** Quick, then settling: the way something let go carries on. */
const LEAVE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Back to its place, the way a spring would take it. */
function springBack(el: HTMLElement | null) {
  if (!el) return;
  el.style.transition = `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out`;
  el.style.transform = '';
  el.style.opacity = '';
}

/**
 * The floating notice over whatever screen is open: a message, a letter, a
 * missed call, a voice note too large to send.
 *
 * It slides in from the top and goes by itself after three seconds. A finger
 * can push it up or off either side; a tap opens what it is about, and the X
 * closes it. However it goes - the parent dropping it too, when its screen is
 * opened from the dock - it slides away instead of blinking off. The parent
 * forgets a notice the moment it is dismissed, and this keeps the last one on
 * screen until it has gone, so a message that comes in meanwhile is never
 * wiped by the end of the old one's exit. One that comes in while a notice is
 * up only changes the words, with a quick fade, so a run of messages does not
 * keep bouncing it in.
 */
export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({
  notification,
  held = false,
  onDismiss,
  onOpenTab
}) => {
  const tr = useT();
  const [shown, setShown] = useState(notification);
  const [leaving, setLeaving] = useState<ToastExit | null>(null);
  // Goes up each time a notice comes in from nothing, which is what slides a
  // fresh card in; one that only replaces the words keeps the card it is on.
  const [entry, setEntry] = useState(0);
  // Whether a card is on screen and staying: not gone, nor on its way out.
  const upRef = useRef(notification !== null);
  // The way the next exit goes: where the finger sent it, or else up.
  const exitRef = useRef<ToastExit>('up');

  useEffect(() => {
    if (notification) {
      if (!upRef.current) setEntry(n => n + 1);
      upRef.current = true;
      exitRef.current = 'up';
      setShown(notification);
      setLeaving(null);
      return;
    }
    if (!upRef.current) return;
    upRef.current = false;
    setLeaving(exitRef.current);
    const timer = window.setTimeout(() => setShown(null), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [notification]);

  // Read out to a screen reader, politely and once. A region that is always
  // there, because one that arrives with its words already in it is not read;
  // and it follows the notice, not the card, so it is quiet while the card
  // slides away. The card itself is not a live region, or it would be said
  // twice, its Reply and X with it.
  const said = (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {notification ? `${notification.title}: ${notification.body}` : ''}
    </p>
  );

  if (!shown) return <>{said}</>;

  const close = (to: ToastExit) => {
    exitRef.current = to;
    onDismiss();
  };

  // Centred by its own transform, which is why the card inside is what moves.
  // Clear of the status bar on a phone that draws under it, top-4 elsewhere.
  return (
    <>
      {said}
      <aside
        aria-label={tr('Partner notification')}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        className={`fixed left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92vw]${leaving ? ' pointer-events-none' : ''}`}
      >
        <ToastCard
          key={entry}
          notification={shown}
          leaving={leaving}
          held={held}
          onClose={close}
          onOpen={tabId => {
            // The screen opens at once, and the notice slides up over it.
            onOpenTab(tabId);
            close('up');
          }}
        />
      </aside>
    </>
  );
};

interface ToastCardProps {
  notification: InAppNotification;
  leaving: ToastExit | null;
  held: boolean;
  onClose: (to: ToastExit) => void;
  onOpen: (tabId: string) => void;
}

/**
 * The card, and the finger on it. The drag is followed in refs and written
 * straight onto the card, as the chat's pull to answer is, so a move is never
 * a render.
 */
const ToastCard: React.FC<ToastCardProps> = ({ notification, leaving, held, onClose, onOpen }) => {
  const tr = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  // The notice the card came in with. Words that replace it fade in; these
  // arrive with the card.
  const firstIdRef = useRef(notification.id);
  const idRef = useRef(notification.id);
  idRef.current = notification.id;
  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const dragRef = useRef<{
    pointerId: number;
    /** The notice the finger came down on. A newer one is not sent away by it. */
    id: string;
    x: number;
    y: number;
    axis: SwipeAxis | null;
    /** The card's size, taken once the drag starts rather than on every move. */
    w: number;
    h: number;
    samples: SwipeSample[];
    armed: boolean;
  } | null>(null);
  /** How far the card sits from its place. */
  const offsetRef = useRef({ x: 0, y: 0 });
  /** When a drag last ended, so the click that follows it does not open the notice. */
  const swallowRef = useRef(0);

  // What holds the three seconds: a finger on the card, a mouse over it,
  // focus inside it - the keyboard or a screen reader on its X - and the
  // call screen over it (held).
  const holdRef = useRef({ finger: false, hover: false, focus: false });
  const heldRef = useRef(held);
  heldRef.current = held;
  const timerRef = useRef(0);
  // Three seconds for a message, a letter or a heart; longer for a notice
  // about something that went wrong, which has more to read.
  const showForRef = useRef(SHOW_MS);
  showForRef.current = notification.type === 'general' ? NOTICE_MS : SHOW_MS;

  /** Starts the three seconds again; none while something holds the card or Two is out of sight. */
  const count = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
    const hold = holdRef.current;
    if (leavingRef.current || heldRef.current || hold.finger || hold.hover || hold.focus) return;
    if (document.visibilityState === 'hidden') return;
    timerRef.current = window.setTimeout(() => closeRef.current('up'), showForRef.current);
  }, []);

  // Each message gets its own three seconds, and gets them all again once a
  // call screen that covered it has gone: it was not seen under that.
  useEffect(() => {
    count();
  }, [notification.id, held, count]);

  // In the background they do not run. Back in front, they start again, so a
  // message that came while Two was away is still there when you look.
  useEffect(() => {
    document.addEventListener('visibilitychange', count);
    return () => {
      document.removeEventListener('visibilitychange', count);
      window.clearTimeout(timerRef.current);
    };
  }, [count]);

  // New words after this card had been let go to leave, but before it began
  // to: it comes back to its place with them.
  useLayoutEffect(() => {
    if (dragRef.current || leavingRef.current) return;
    const { x, y } = offsetRef.current;
    if (!x && !y) return;
    offsetRef.current = { x: 0, y: 0 };
    springBack(cardRef.current);
  }, [notification.id]);

  // Going: on from wherever the finger left it, the way it was sent, fading
  // as it goes. With reduced motion it only fades, where it is.
  useLayoutEffect(() => {
    if (!leaving) return;
    window.clearTimeout(timerRef.current);
    dragRef.current = null;
    const el = cardRef.current;
    if (!el) return;
    const { x, y } = offsetRef.current;
    el.style.transition = `transform ${LEAVE_MS}ms ${LEAVE_EASE}, opacity ${LEAVE_MS}ms ease-out`;
    if (!prefersReducedMotion()) {
      el.style.transform =
        leaving === 'up'
          ? `translate3d(${x}px, calc(-100% - 2rem - env(safe-area-inset-top, 0px)), 0)`
          : `translate3d(${leaving === 'left' ? -window.innerWidth : window.innerWidth}px, ${y}px, 0)`;
    }
    el.style.opacity = '0';
  }, [leaving]);

  const pressStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (leavingRef.current || dragRef.current?.axis) return;
    swallowRef.current = 0;
    dragRef.current = {
      pointerId: e.pointerId,
      id: notification.id,
      x: e.clientX,
      y: e.clientY,
      axis: null,
      w: 0,
      h: 0,
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
      armed: false
    };
    holdRef.current.finger = true;
    count();
  };

  const pressMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = cardRef.current;
    if (!d || d.pointerId !== e.pointerId || !el || leavingRef.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      d.axis = swipeAxis(dx, dy);
      if (!d.axis) return;
      d.w = el.offsetWidth;
      d.h = el.offsetHeight;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* the finger is already up */
      }
    }
    d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > SPEED_WINDOW_MS) d.samples.shift();
    const off = swipeOffset(d.axis, dx, dy);
    offsetRef.current = off;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
    el.style.opacity = String(swipeFade(off, d.w, d.h));
    if (!d.armed && swipePast(d.axis, dx, dy, d.w)) {
      d.armed = true;
      haptic('tick');
    }
  };

  const pressEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    holdRef.current.finger = false;
    if (!d.axis) {
      // A tap: its click opens the notice, or the X closes it.
      count();
      return;
    }
    swallowRef.current = Date.now();
    let to: ToastExit | null = null;
    // Not when the phone took the finger away (pointercancel), nor when a
    // newer message came in under it: that one is not thrown away unseen.
    if (e.type === 'pointerup' && d.id === idRef.current) {
      d.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      const { vx, vy } = liftSpeed(d.samples);
      to = swipeVerdict({ axis: d.axis, dx: e.clientX - d.x, dy: e.clientY - d.y, vx, vy, width: d.w });
    }
    if (to) {
      onClose(to);
      return;
    }
    offsetRef.current = { x: 0, y: 0 };
    springBack(cardRef.current);
    count();
  };

  const hoverStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    holdRef.current.hover = true;
    count();
  };

  const hoverEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    holdRef.current.hover = false;
    // A button let go outside the card before it had dragged never comes back
    // here as a pointerup.
    const d = dragRef.current;
    if (d && !d.axis && d.pointerId === e.pointerId) {
      dragRef.current = null;
      holdRef.current.finger = false;
    }
    count();
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'letter':
        return <Mail className="w-4 h-4 text-amber-600" />;
      case 'touch':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />;
      default:
        return <MessageSquare className="w-4 h-4 text-rose-500" />;
    }
  };

  // Slides down as it fades in; with reduced motion it only fades. Only
  // colours ease on their own (transition-colors, not -all): the drag writes
  // the card's transform, which has to keep up with the finger.
  return (
    <div
      ref={cardRef}
      onPointerDown={pressStart}
      onPointerMove={pressMove}
      onPointerUp={pressEnd}
      onPointerCancel={pressEnd}
      onPointerEnter={hoverStart}
      onPointerLeave={hoverEnd}
      // Focus anywhere inside holds it (focusin and focusout, as React's
      // onFocus and onBlur are), from the keyboard or from a screen reader,
      // which may not count as :focus-visible. Not focus a mouse press puts on
      // the X: the press holds it while it lasts, and once let go its time runs.
      onFocus={() => {
        if (!dragRef.current) holdRef.current.focus = true;
        count();
      }}
      onBlur={e => {
        const to = e.relatedTarget;
        holdRef.current.focus = to instanceof Node && e.currentTarget.contains(to);
        count();
      }}
      onClickCapture={e => {
        if (Date.now() - swallowRef.current > SWALLOW_MS) return;
        swallowRef.current = 0;
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={() => onOpen(notification.tabId)}
      className="bg-linen-surface/95 backdrop-blur-md border border-linen-border rounded-2xl p-3.5 shadow-lg flex items-center space-x-3 cursor-pointer hover:border-linen-accent transition-colors group touch-none select-none animate-in fade-in slide-in-from-top-full duration-300"
    >
      <div
        key={notification.id}
        className={`flex-1 min-w-0 flex items-center space-x-3${
          notification.id !== firstIdRef.current ? ' animate-in fade-in duration-150' : ''
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-linen-variant flex items-center justify-center shrink-0 border border-linen-border/60 group-hover:scale-105 transition-transform">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-linen-primary truncate">
              {notification.title}
            </h5>
            <span className="text-[10px] text-linen-accent font-medium inline-flex items-center group-hover:translate-x-0.5 transition-transform">
              {tr('Reply')} <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
            </span>
          </div>
          <p className="text-xs text-linen-secondary truncate mt-0.5">
            {notification.body}
          </p>
        </div>
      </div>

      <button
        aria-label={tr('Dismiss')}
        onClick={(e) => {
          e.stopPropagation();
          onClose('up');
        }}
        className="p-1 text-linen-secondary/60 hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
