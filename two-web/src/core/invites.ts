// Linking two partners by phone/email instead of reading a code aloud.
//
// The inviter leaves the pairing code addressed to their partner's identifier;
// the partner picks it up on their next sign-in and adopts the same space.
//
// Be clear about the trade this makes: the code passes through the server, so
// the operator could read it, and therefore could read the couple's content.
// That is the cost of never making anyone type a code, and it is why the app no
// longer claims the operator cannot read anything. The manual code path in
// Settings ("Change our link code") stays available and never touches the
// server, for anyone who wants the stronger guarantee.

import { supabase, getSession, normalizeIdentifier, classifyIdentifier } from './auth';

const INVITE_TTL_HOURS = 72;

export interface PendingInvite {
  id: string;
  code: string;
  from_name: string | null;
}

export interface InviteResult {
  ok: boolean;
  error?: string;
}

/** Leaves `code` for whoever signs in as `identifier`. */
export async function sendInvite(identifier: string, code: string, fromName: string): Promise<InviteResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured on this deployment.' };
  if (classifyIdentifier(identifier) === 'invalid') {
    return { ok: false, error: 'Enter your partner’s 10-digit mobile number or email.' };
  }

  const session = await getSession();
  if (!session) return { ok: false, error: 'You need to be signed in to invite someone.' };

  const to = normalizeIdentifier(identifier);
  if (to === normalizeIdentifier(session.user.phone || session.user.email || '')) {
    return { ok: false, error: 'That is your own account — invite your partner instead.' };
  }

  const expires = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();

  // One live invite per (sender, recipient): re-inviting refreshes rather than
  // piling up codes the partner would have to choose between.
  const { error } = await supabase.from('space_invites').upsert(
    {
      from_user: session.user.id,
      to_identifier: to,
      from_name: fromName || null,
      code,
      expires_at: expires,
      accepted_at: null
    },
    { onConflict: 'from_user,to_identifier' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Any unexpired invite addressed to the signed-in user. */
export async function fetchPendingInvite(): Promise<PendingInvite | null> {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('space_invites')
    .select('id, code, from_name')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as PendingInvite;
}

/** Marks the invite used so it stops being offered on every sign-in. */
export async function acceptInvite(inviteId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('space_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inviteId);
  if (error) console.error('[Invites] Could not mark invite accepted', error.message);
}
