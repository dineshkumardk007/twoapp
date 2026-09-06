// Which devices are signed in to this account, and revoking one remotely.
//
// The row holds no key material - a label and timestamps only. Revocation is
// cooperative: the revoked device signs itself out the next time it checks, on
// load and whenever the tab regains focus. That is honest about what it can do,
// since a device that never comes back online cannot be reached at all.

import { supabase, getSession } from './auth';
import { getDeviceId } from './space';

export interface DeviceRow {
  device_id: string;
  label: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

/** A short human label from the user agent, e.g. "Chrome on Windows". */
export function describeThisDevice(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;

  const os =
    /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' :
    /Android/i.test(ua) ? 'Android' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS X/i.test(ua) ? 'Mac' :
    /Linux/i.test(ua) ? 'Linux' : 'Unknown';

  // Order matters: Edge and Opera both claim to be Chrome.
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\//i.test(ua) ? 'Opera' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'Browser';

  return `${browser} on ${os}`;
}

/** Records this device against the account, refreshing its last-seen time. */
export async function registerThisDevice(): Promise<void> {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;

  const { error } = await supabase.from('user_devices').upsert(
    {
      user_id: session.user.id,
      device_id: getDeviceId(),
      label: describeThisDevice(),
      last_seen_at: new Date().toISOString(),
      // Signing in again on a revoked device deliberately un-revokes it: the
      // password is the authority, and the alternative is a device the owner
      // can never use again.
      revoked_at: null
    },
    { onConflict: 'user_id,device_id' }
  );

  if (error) console.error('[Devices] Could not register this device', error.message);
}

export async function listDevices(): Promise<DeviceRow[]> {
  if (!supabase) return [];
  const session = await getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('user_devices')
    .select('device_id, label, created_at, last_seen_at, revoked_at')
    .eq('user_id', session.user.id)
    .order('last_seen_at', { ascending: false });

  if (error || !data) return [];
  return data as DeviceRow[];
}

export async function revokeDevice(deviceId: string): Promise<boolean> {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;

  const { error } = await supabase
    .from('user_devices')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .eq('device_id', deviceId);

  if (error) console.error('[Devices] Could not revoke device', error.message);
  return !error;
}

/** True when this device has been signed out from somewhere else. */
export async function isThisDeviceRevoked(): Promise<boolean> {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;

  const { data, error } = await supabase
    .from('user_devices')
    .select('revoked_at')
    .eq('user_id', session.user.id)
    .eq('device_id', getDeviceId())
    .maybeSingle();

  // A network failure must not lock anyone out of their own sanctuary.
  if (error || !data) return false;
  return Boolean(data.revoked_at);
}

export function isThisDevice(deviceId: string): boolean {
  return deviceId === getDeviceId();
}
