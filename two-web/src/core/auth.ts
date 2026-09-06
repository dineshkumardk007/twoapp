// Supabase-backed accounts.
//
// One account per person, identified by EITHER a 10-digit phone number OR an
// email address - whichever they prefer. Supabase enforces uniqueness on both
// columns of auth.users, so a second signup with the same number is rejected by
// the database rather than by a check we could get wrong.
//
// Neither identifier is verified (no OTP, no confirmation mail), which is a
// deliberate product choice. See docs/AUTH.md for what that costs.

import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { WrappedSecret, SealedPayload } from './keyEscrow';

const SUPABASE_URL = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the deployment has no Supabase configured; the app then runs without accounts. */
export const isAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

export type IdentifierKind = 'phone' | 'email' | 'invalid';

/** India-style 10-digit local numbers; Supabase wants E.164 on the wire. */
const PHONE_COUNTRY_CODE = '+91';

export function classifyIdentifier(raw: string): IdentifierKind {
  const value = raw.trim();
  if (!value) return 'invalid';

  if (value.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? 'email' : 'invalid';
  }

  const digits = value.replace(/\D/g, '');
  // Accept a bare 10-digit number, or the same number already carrying +91.
  if (digits.length === 10) return 'phone';
  if (digits.length === 12 && digits.startsWith('91')) return 'phone';
  return 'invalid';
}

/** Canonical form sent to Supabase, so one number cannot register twice. */
export function normalizeIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes('@')) return value.toLowerCase();

  const digits = value.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return `${PHONE_COUNTRY_CODE}${local}`;
}

function credentialsFor(identifier: string, password: string) {
  const kind = classifyIdentifier(identifier);
  const value = normalizeIdentifier(identifier);
  return kind === 'email'
    ? { email: value, password }
    : { phone: value, password };
}

export interface AuthResult {
  ok: boolean;
  session?: Session | null;
  error?: string;
}

/** Turns Supabase's wording into something a couple would understand. */
function friendlyError(message: string, kind: IdentifierKind): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return kind === 'phone'
      ? 'That mobile number already has an account. Try signing in instead.'
      : 'That email already has an account. Try signing in instead.';
  }
  if (m.includes('invalid login credentials')) return 'Wrong number/email or password.';
  if (m.includes('password')) return 'Password must be at least 8 characters.';
  return message;
}

export async function signUp(identifier: string, password: string, displayName: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured on this deployment.' };

  const kind = classifyIdentifier(identifier);
  if (kind === 'invalid') return { ok: false, error: 'Enter a 10-digit mobile number or an email address.' };
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const { data, error } = await supabase.auth.signUp({
    ...credentialsFor(identifier, password),
    options: { data: { display_name: displayName } }
  });

  if (error) return { ok: false, error: friendlyError(error.message, kind) };
  return { ok: true, session: data.session };
}

export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured on this deployment.' };

  const kind = classifyIdentifier(identifier);
  if (kind === 'invalid') return { ok: false, error: 'Enter a 10-digit mobile number or an email address.' };

  const { data, error } = await supabase.auth.signInWithPassword(credentialsFor(identifier, password));
  if (error) return { ok: false, error: friendlyError(error.message, kind) };
  return { ok: true, session: data.session };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** The access token the relay checks when a socket connects. */
export async function getAccessToken(): Promise<string | null> {
  return (await getSession())?.access_token ?? null;
}

// ---------------------------------------------------------------------------
// Space key escrow
// ---------------------------------------------------------------------------

export interface EscrowRow {
  /** Both wrap the same master key, so either secret opens the space. */
  wrapped_by_password: WrappedSecret;
  wrapped_by_recovery: WrappedSecret;
  /** The pairing code and join phrase, sealed under that master key. */
  payload: SealedPayload;
}

/** Stores both wrappings of the pairing code for the signed-in user. */
export async function saveEscrow(row: EscrowRow): Promise<boolean> {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;

  const { error } = await supabase.from('space_escrow').upsert({
    user_id: session.user.id,
    wrapped_by_password: row.wrapped_by_password,
    wrapped_by_recovery: row.wrapped_by_recovery,
    payload: row.payload,
    updated_at: new Date().toISOString()
  });

  if (error) console.error('[Auth] Could not save space escrow', error.message);
  return !error;
}

/** Updates only the sealed payload, leaving both key wrappings untouched. */
export async function updateEscrowPayload(payload: SealedPayload): Promise<boolean> {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;

  const { error } = await supabase
    .from('space_escrow')
    .update({ payload, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id);

  if (error) console.error('[Auth] Could not update space escrow', error.message);
  return !error;
}

export async function loadEscrow(): Promise<EscrowRow | null> {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('space_escrow')
    .select('wrapped_by_password, wrapped_by_recovery, payload')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as EscrowRow;
}
