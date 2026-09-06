-- Two — Supabase schema
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.
--
-- Identity itself lives in Supabase's own auth.users table, which already
-- enforces UNIQUE on both phone and email. That is what stops the same mobile
-- number registering twice — we do not re-implement it here, and should not.

-- ---------------------------------------------------------------------------
-- space_escrow: the pairing code, wrapped twice, so a new device can restore.
-- ---------------------------------------------------------------------------
-- Both columns hold AES-GCM ciphertext produced in the browser:
--   wrapped_by_password — opened with the login password
--   wrapped_by_recovery — opened with the 12-word recovery phrase
-- The server never receives either passphrase, so these are opaque to it.

create table if not exists public.space_escrow (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  wrapped_by_password jsonb not null,
  wrapped_by_recovery jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.space_escrow enable row level security;

-- A user may only ever touch their own escrow row.
drop policy if exists "own escrow: read"   on public.space_escrow;
drop policy if exists "own escrow: write"  on public.space_escrow;
drop policy if exists "own escrow: update" on public.space_escrow;

create policy "own escrow: read"
  on public.space_escrow for select
  using (auth.uid() = user_id);

create policy "own escrow: write"
  on public.space_escrow for insert
  with check (auth.uid() = user_id);

create policy "own escrow: update"
  on public.space_escrow for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- space_invites: one partner leaves the pairing code for the other.
-- ---------------------------------------------------------------------------
-- Addressed by identifier rather than user id, because the partner may not have
-- an account yet when the invite is sent.

create table if not exists public.space_invites (
  id             uuid primary key default gen_random_uuid(),
  from_user      uuid not null references auth.users(id) on delete cascade,
  from_name      text,
  to_identifier  text not null,
  code           text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  accepted_at    timestamptz
);

-- Re-inviting the same person replaces the previous invite instead of stacking.
create unique index if not exists space_invites_from_to_idx
  on public.space_invites (from_user, to_identifier);

create index if not exists space_invites_recipient_idx
  on public.space_invites (to_identifier) where accepted_at is null;

alter table public.space_invites enable row level security;

drop policy if exists "invite: sender writes"     on public.space_invites;
drop policy if exists "invite: sender updates"    on public.space_invites;
drop policy if exists "invite: recipient reads"   on public.space_invites;
drop policy if exists "invite: recipient accepts" on public.space_invites;

create policy "invite: sender writes"
  on public.space_invites for insert
  with check (auth.uid() = from_user);

create policy "invite: sender updates"
  on public.space_invites for update
  using (auth.uid() = from_user);

-- The recipient is matched on the identifier attached to their own JWT, so one
-- user cannot read invites addressed to somebody else.
create policy "invite: recipient reads"
  on public.space_invites for select
  using (
    auth.uid() = from_user
    or to_identifier = coalesce(auth.jwt() ->> 'phone', '')
    or to_identifier = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "invite: recipient accepts"
  on public.space_invites for update
  using (
    to_identifier = coalesce(auth.jwt() ->> 'phone', '')
    or to_identifier = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ---------------------------------------------------------------------------
-- Housekeeping: expired invites carry a pairing code, so do not keep them.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_invites()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.space_invites
  where expires_at < now() or accepted_at is not null;
$$;
