// How a Midnight Radio update from the partner's phone is taken in.
//
// The radio is one shared record, sent whole and replaced whole: the station,
// the volume, who is listening. That is right for what is on now - the latest
// word wins. Favourites are different: a list the two of you build up over
// time. Sent whole, an update composed before the other phone's latest star
// (queued while offline, say) would quietly wipe that star out. So
// favourites are merged instead: each star and each unstar carries its time,
// and for every station the later of the two wins, whichever phone it came from.

import { LiveRadioStation, MidnightRadioState } from '../types';
import { cleanStation, sameStation } from './liveStations';

const MAX_FAVORITES = 24;
const MAX_REMOVED = 48;

type Removal = { url: string; at: number };

function removals(list: unknown): Removal[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (r): r is Removal => !!r && typeof r.url === 'string' && typeof r.at === 'number' && Number.isFinite(r.at)
  );
}

function favorites(list: unknown): LiveRadioStation[] {
  return (Array.isArray(list) ? list : []).map(cleanStation).filter((s): s is LiveRadioStation => !!s);
}

/** Both phones' favourites, each station decided by its latest star or unstar. */
export function mergeFavorites(
  a: Pick<MidnightRadioState, 'liveFavorites' | 'liveFavoritesRemoved'> | undefined,
  b: Pick<MidnightRadioState, 'liveFavorites' | 'liveFavoritesRemoved'>
): Pick<MidnightRadioState, 'liveFavorites' | 'liveFavoritesRemoved'> {
  const latest = new Map<string, { at: number; station?: LiveRadioStation }>();
  const consider = (url: string, at: number, station?: LiveRadioStation) => {
    const seen = latest.get(url);
    // On a tie, the star wins: losing a favourite is the worse mistake.
    if (!seen || at > seen.at || (at === seen.at && station && !seen.station)) latest.set(url, { at, station });
  };
  for (const s of [...favorites(a?.liveFavorites), ...favorites(b.liveFavorites)]) consider(s.url, s.starredAt ?? 0, s);
  for (const r of [...removals(a?.liveFavoritesRemoved), ...removals(b.liveFavoritesRemoved)]) consider(r.url, r.at);

  const starred: LiveRadioStation[] = [];
  const removed: Removal[] = [];
  for (const [url, e] of latest) {
    if (e.station) starred.push(e.station);
    else removed.push({ url, at: e.at });
  }
  starred.sort((x, y) => (y.starredAt ?? 0) - (x.starredAt ?? 0));
  removed.sort((x, y) => y.at - x.at);
  return { liveFavorites: starred.slice(0, MAX_FAVORITES), liveFavoritesRemoved: removed.slice(0, MAX_REMOVED) };
}

/**
 * Stars or unstars a station, now - or, if the other phone's clock is ahead
 * and its last word on this station is stamped later than now, just after
 * that, so the tap always takes effect.
 */
export function toggleFavorite(radio: MidnightRadioState, station: LiveRadioStation, now = Date.now()): MidnightRadioState {
  const current = favorites(radio.liveFavorites);
  const mine = current.find(f => sameStation(f, station));
  const lastAt = Math.max(
    mine?.starredAt ?? 0,
    ...removals(radio.liveFavoritesRemoved).filter(r => r.url === station.url).map(r => r.at)
  );
  const at = Math.max(now, lastAt + 1);
  const change: Pick<MidnightRadioState, 'liveFavorites' | 'liveFavoritesRemoved'> = mine
    ? { liveFavorites: [], liveFavoritesRemoved: [{ url: station.url, at }] }
    : { liveFavorites: [{ ...station, starredAt: at }], liveFavoritesRemoved: [] };
  return { ...radio, ...mergeFavorites(radio, change) };
}

/** Whispers from both, once each, newest first: they are only ever added. */
function mergeWhispers(a: MidnightRadioState['whispers'] | undefined, b: MidnightRadioState['whispers'] | undefined) {
  const byId = new Map<string, MidnightRadioState['whispers'][number]>();
  for (const w of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (w && typeof w.id === 'string' && !byId.has(w.id)) byId.set(w.id, w);
  }
  return [...byId.values()].sort((x, y) => (y.timestamp ?? 0) - (x.timestamp ?? 0));
}

/**
 * Takes in the partner's radio: theirs for what is playing; merged for the
 * favourites and the whispers, which a late update must not take away.
 *
 * One more thing, for a partner still on an older version of the app: it
 * knows nothing of the live band, so picking one of Two's own stations
 * changes the station but leaves the band at 'live'. Live radio is always
 * chosen with a note of which of Two's stations was on at the time
 * (liveForStationId); an older app passes that note along unchanged, so
 * when it no longer matches the station, the band is Two's. Decided from
 * the update alone, so every later update from that phone reads the same.
 */
export function mergeIncomingRadio(prev: MidnightRadioState | undefined, incoming: MidnightRadioState): MidnightRadioState {
  const merged: MidnightRadioState = {
    ...incoming,
    ...mergeFavorites(prev, incoming),
    whispers: mergeWhispers(prev?.whispers, incoming.whispers)
  };
  if (incoming.band === 'live' && incoming.liveForStationId !== undefined && incoming.liveForStationId !== incoming.stationId) {
    merged.band = 'two';
  }
  return merged;
}
