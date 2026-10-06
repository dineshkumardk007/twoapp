import React from 'react';
import { Users } from 'lucide-react';
import type { SpaceRole } from '../core/space';
import { useBackLayer } from '../core/backStack';

interface RoleClashDialogProps {
  /** The name the other phone announced, in this phone's own seat. */
  otherName: string;
  onChoose: (role: SpaceRole) => void;
  /** It is this phone's owner, on another device - not a clash at all. */
  onSamePerson: () => void;
  onDismiss: () => void;
}

/**
 * Asks which side of the space this phone is, when both phones claim the same.
 *
 * A space has two seats, and two phones in one seat cannot tell each other
 * apart: what is sent while one is off never reaches it, calls ring nowhere,
 * and each phone shows the other as offline. It is easy to arrive at - the
 * person who made the space links a new phone and picks the wrong side - and
 * until now nothing ever said so.
 *
 * The question is put as a fact to answer rather than a switch to flip. A
 * switch shown on both phones gets flipped on both, and the two of them land
 * together in the other seat; two truthful answers always come apart.
 */
export const RoleClashDialog: React.FC<RoleClashDialogProps> = ({ otherName, onChoose, onSamePerson, onDismiss }) => {
  const name = otherName.trim() || 'Your partner';

  // Shown only while there is a clash, so it is open whenever it is mounted.
  // The phone's Back button answers "Not now"; the question comes back if
  // the phones still clash the next time they hear from each other.
  useBackLayer(true, onDismiss);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-clash-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl border border-linen-border bg-linen-surface p-5 text-linen-primary shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-amber-300/60 bg-amber-50 p-2 text-amber-800">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h2 id="role-clash-title" className="text-sm font-semibold leading-snug">
              {name}&rsquo;s phone is set up the same way as yours
            </h2>
            <p className="text-xs leading-relaxed text-linen-secondary">
              Two can&rsquo;t tell your phones apart like this. Messages sent while one is off won&rsquo;t
              reach it, calls between you won&rsquo;t ring, and {name} will look offline. Answer for this
              phone &mdash; {name}&rsquo;s phone asks the same question.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onChoose('user')}
            className="w-full rounded-2xl bg-linen-primary px-4 py-3 text-left text-linen-surface shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
          >
            <span className="block text-sm font-semibold">I created this space</span>
            <span className="block text-[11px] opacity-80">I made the code and sent it</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('partner')}
            className="w-full rounded-2xl border border-linen-border bg-linen-variant/60 px-4 py-3 text-left transition-colors hover:bg-linen-variant cursor-pointer"
          >
            <span className="block text-sm font-semibold">{name} created it</span>
            <span className="block text-[11px] text-linen-secondary">I joined with the code they sent me</span>
          </button>
          <button
            type="button"
            onClick={onSamePerson}
            className="w-full rounded-2xl px-4 py-2 text-left text-xs text-linen-secondary transition-colors hover:text-linen-primary cursor-pointer"
          >
            &ldquo;{name}&rdquo; is me, on another device
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-linen-secondary">
          Once it is fixed, messages, letters and memories that went missing come back. Messages from
          before may show on the wrong side of the chat.
        </p>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full py-1 text-center text-xs text-linen-secondary transition-colors hover:text-linen-primary cursor-pointer"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
