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

/** Stars or unstars a station, now. */
export function toggleFavorite(radio: MidnightRadioState, station: LiveRadioStation, now = Date.now()): MidnightRadioState {
  const current = favorites(radio.liveFavorites);
  const starred = current.some(f => sameStation(f, station));
  const change: Pick<MidnightRadioState, 'liveFavorites' | 'liveFavoritesRemoved'> = starred
    ? { liveFavorites: [], liveFavoritesRemoved: [{ url: station.url, at: now }] }
    : { liveFavorites: [{ ...station, starredAt: now }], liveFavoritesRemoved: [] };
  return { ...radio, ...mergeFavorites(radio, change) };
}

/**
 * Takes in the partner's radio: theirs for what is playing, merged for the
 * favourites.
 *
 * One more thing, for a partner still on an older version of the app: it
 * knows nothing of the live band, so picking one of Two's own stations
 * changes the station but leaves the band at 'live'. This version always sets
 * the band with the station, so a station change with the band still live
 * can only mean that - and is read as a switch to Two's stations.
 */
export function mergeIncomingRadio(prev: MidnightRadioState | undefined, incoming: MidnightRadioState): MidnightRadioState {
  const merged: MidnightRadioState = { ...incoming, ...mergeFavorites(prev, incoming) };
  if (
    prev &&
    incoming.band === 'live' &&
    prev.band === 'live' &&
    incoming.stationId !== prev.stationId &&
    sameStation(cleanStation(incoming.liveStation), cleanStation(prev.liveStation))
  ) {
    merged.band = 'two';
  }
  return merged;
}
