import React, { useState } from 'react';
import { UserPlus, Check, Loader2 } from 'lucide-react';
import { sendInvite } from '../core/invites';
import { generateJoinPhrase } from '../core/space';

interface InvitePartnerBannerProps {
  spaceCode?: string;
  userName?: string;
  joinPhrase?: string;
  onSetJoinPhrase?: (phrase: string) => void;
}

/**
 * Shown while a space has never had a partner in it.
 *
 * Signing up silently creates a brand new sanctuary, so an account with nobody
 * invited looks exactly like a broken one: it signs in, it connects, and
 * nothing ever syncs. Burying the invite in Settings meant the one action that
 * turns a lone space into a shared one was the hardest to find - so it lives
 * here, in the way, until it has been done.
 */
export const InvitePartnerBanner: React.FC<InvitePartnerBannerProps> = ({
  spaceCode,
  userName = '',
  joinPhrase = '',
  onSetJoinPhrase
}) => {
  const [to, setTo] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [phrase, setPhrase] = useState(joinPhrase);

  const submit = async () => {
    if (!spaceCode || !to.trim()) return;
    setState('sending');
    setError('');

    // The invite travels through the server; these four words do not, and they
    // are what keep the operator out. Mint them now if this space has none.
    let words = phrase || joinPhrase;
    if (!words) {
      words = generateJoinPhrase();
      setPhrase(words);
      onSetJoinPhrase?.(words);
    }

    const res = await sendInvite(to, spaceCode, userName);
    if (res.ok) {
      setState('sent');
    } else {
      setState('idle');
      setError(res.error || 'Could not send that invitation.');
    }
  };

  if (state === 'sent') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-emerald-900">
          <p className="flex items-center text-sm font-semibold">
            <Check className="w-4 h-4 mr-1.5" />
            Invitation sent
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            When they sign in, their sanctuary joins yours. They will be asked for these four
            words — say them out loud, never type them into a message:
          </p>
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 font-mono text-sm font-bold tracking-wide">
            {phrase || joinPhrase}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
      <div className="rounded-2xl border border-linen-primary/30 bg-linen-variant/70 px-4 py-3.5">
        <p className="flex items-center text-sm font-semibold text-linen-primary">
          <UserPlus className="w-4 h-4 mr-1.5 text-linen-accent" />
          You are the only one here
        </p>
        <p className="mt-1 text-xs text-linen-secondary leading-relaxed">
          Signing up made a brand new sanctuary just for you. Invite your partner and their app
          will join this one — until then nothing will sync, because there is nobody to sync with.
        </p>

        <div className="mt-2.5 flex gap-1.5">
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Their mobile number or email"
            className="flex-1 min-w-0 rounded-xl border border-linen-border bg-linen-surface px-3 py-2 text-sm text-linen-primary placeholder:text-linen-secondary/60"
          />
          <button
            onClick={submit}
            disabled={state === 'sending' || !to.trim()}
            className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2 text-xs font-medium text-linen-surface transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
          </button>
        </div>

        {error && <p className="mt-1.5 text-[11px] text-rose-700">{error}</p>}
      </div>
    </div>
  );
};
