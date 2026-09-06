# Accounts & Login — Setup

Two now opens on a login page. One account per person, identified by **either a
10-digit mobile number or an email address**, with a password.

Nothing below is optional if you want login to actually mean something — in
particular, the relay ignores logins entirely until `SUPABASE_JWT_SECRET` is set.

---

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → API** gives you:
   - `Project URL`
   - `anon public` key — safe to ship in the frontend; it only grants what your
     row-level security policies allow
3. **Settings → API → JWT Settings** gives you the `JWT Secret`. This one is
   **not** safe to ship anywhere near the browser — it belongs only on the relay.

## 2. Turn off confirmations

**Authentication → Providers → Email** → disable *Confirm email*.
**Authentication → Providers → Phone** → enable the provider, disable *Confirm phone*.

You chose unverified identifiers, so no SMS provider is needed and nothing costs
money. See [What unverified means](#what-unverified-means) for the consequences.

## 3. Create the tables

Open **SQL Editor → New query**, paste the contents of
[`two-server/supabase/schema.sql`](../two-server/supabase/schema.sql), and run it.
It is idempotent, so re-running is safe.

It creates three tables, all with row-level security on:

| Table | Holds | Who can read it |
|---|---|---|
| `space_escrow` | A master key wrapped under your password and recovery phrase, plus the pairing code and join phrase sealed under it | Only you |
| `space_invites` | A code left for a partner | Only the sender and the addressee |
| `user_devices` | Device label and last-seen time, for the device list | Only you |

Re-run this file after pulling updates. It has gained a `payload` column on
`space_escrow` and the whole `user_devices` table since the first version, and
escrow saves will fail against the older shape.

Identity itself lives in Supabase's own `auth.users`, which already enforces
`UNIQUE` on both phone and email — **that** is what prevents the same mobile
number registering twice. We deliberately do not reimplement it.

## 4. Set the environment variables

**Web app** (Vercel → Settings → Environment Variables, and `.env.local` for dev):

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Relay** (Render → Environment):

```env
SUPABASE_JWT_SECRET=your-jwt-secret-from-step-1
```

Both sides degrade safely: with no `VITE_SUPABASE_*` the app runs account-free
exactly as before, and with no `SUPABASE_JWT_SECRET` the relay accepts every
socket. **Set both, or login is decorative.**

---

## How a couple gets connected

There is still a pairing code underneath — it derives every encryption key — but
nobody ever sees or types it.

1. **Ravi signs up.** A code is generated silently. It is encrypted twice: once
   under his password, once under a 12-word recovery phrase shown on screen.
   Both go to `space_escrow`.
2. **Ravi invites Priya** from Settings, by her mobile number or email. The code
   is left in `space_invites`, addressed to her.
3. **Priya signs up or signs in.** Her pending invite is found, she adopts the
   same code, and the two devices land in the same encrypted space.
4. **Either of them on a new phone** signs in; the escrowed code is unwrapped
   with their password and the space comes back.

## What unverified means

You chose not to verify phone numbers or email addresses. Be aware:

- **Anyone can register any identifier**, including one that isn't theirs. There
  is nothing stopping someone claiming your number before you do.
- **There is no password reset.** Reset needs a channel we can prove belongs to
  the user. Without verification there isn't one.
- Consequently the **12-word recovery phrase is the only way back** into a space
  if a password is forgotten. If a user loses both, their history is
  unrecoverable — by them or by you.

Turning on email confirmation later costs nothing and fixes the reset path.
SMS verification needs a paid provider (Twilio and similar).

## What the operator can and cannot see

Honest version, because the app used to claim something stronger:

- Message content, journals and letters are encrypted **on the device**. The
  relay stores ciphertext and cannot read them.
- The escrowed pairing code is encrypted under secrets the server never
  receives, so `space_escrow` is opaque to it.
- **But** an invite carries the pairing code through the server. An operator who
  read `space_invites` while an invite was in flight could derive the keys.

So the accurate claim is *"the operator is trusted not to read your space"*, not
*"the operator cannot"*. The old `zero_knowledge` / "operator cannot read"
wording has been removed from `/health` and the onboarding copy accordingly.

Couples who want the stronger guarantee can still use **Settings → Change our
link code**, which rotates to a code that is read aloud and never touches the
server.

## If phone signup is rejected

Supabase's phone provider normally expects an SMS provider to be configured,
even with *Confirm phone* switched off. If signup with a mobile number fails
while email works, that is the cause, and there are two ways out:

- **Turn on email confirmation and use email only** — free, and it restores a
  working password reset.
- **Map numbers onto synthetic emails** (`919876543210@phone.local`) so phone
  users go through the email provider. Nothing changes for the user, who still
  types their number. Ask and I will wire it up.

Do not add an SMS provider just to make signup work unless you actually want
verified numbers; it costs per message.

## Passwords

The login password does double duty: it authenticates the account **and**
encrypts the local vault, replacing the old 4-digit PIN. That is a real upgrade —
a PIN was 10,000 possibilities; a password is not.

It is held in memory only, never written to disk, which is why the app asks for
it each time it opens.
