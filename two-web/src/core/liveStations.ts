// Real radio, streamed: the Tamil FM stations Midnight Radio offers, and a
// search across the rest.
//
// Real FM - an antenna and a tuner - is out of reach: Android gives apps no
// access to a phone's FM chip, and most phones no longer have one. What every
// FM station does have is the stream of the same broadcast on the internet,
// which is what radio apps play.
//
// The hand-picked list is broadcasters' own streams only, each checked to be
// on air and playable: All India Radio's FM stations across Tamil Nadu, and
// the Tamil FM stations of Singapore, Malaysia and Sri Lanka. Chennai's private
// FM stations (Hello, Suryan, Radio City, Mirchi) are left out: their streams
// are kept to their own apps, and what circulates are unofficial copies.
//
// Search uses Radio Browser (radio-browser.info), a free, community-run
// directory of stations. Only https streams in a format the app can play are
// shown.

import { LiveRadioStation } from '../types';

const AIR = 'https://air.pc.cdn.bitgravity.com/air/live';

/** All India Radio, Tamil Nadu: HLS streams from AIR's own CDN. */
const AIR_TAMIL: LiveRadioStation[] = [
  { id: 'air-rainbow-chennai', name: 'FM Rainbow', place: 'Chennai', broadcaster: 'All India Radio', frequency: '101.4 FM', url: `${AIR}/pbaudio022/playlist.m3u8`, hls: true },
  { id: 'air-gold-chennai', name: 'FM Gold', place: 'Chennai', broadcaster: 'All India Radio', url: `${AIR}/pbaudio021/playlist.m3u8`, hls: true },
  { id: 'air-vividh-bharati-chennai', name: 'Vividh Bharati', place: 'Chennai', broadcaster: 'All India Radio', url: `${AIR}/pbaudio024/playlist.m3u8`, hls: true },
  { id: 'air-kodai-fm', name: 'Kodai FM', place: 'Kodaikanal', broadcaster: 'All India Radio', frequency: '100.5 FM', url: `${AIR}/pbaudio051/playlist.m3u8`, hls: true },
  { id: 'air-madurai-fm', name: 'Madurai FM', place: 'Madurai', broadcaster: 'All India Radio', frequency: '103.3 FM', url: `${AIR}/pbaudio126/playlist.m3u8`, hls: true },
  { id: 'air-rainbow-puducherry', name: 'FM Rainbow', place: 'Puducherry', broadcaster: 'All India Radio', url: `${AIR}/pbaudio098/playlist.m3u8`, hls: true },
  { id: 'air-rainbow-tirunelveli', name: 'FM Rainbow', place: 'Tirunelveli', broadcaster: 'All India Radio', url: `${AIR}/pbaudio062/playlist.m3u8`, hls: true },
  { id: 'air-nagercoil-fm', name: 'Nagercoil FM', place: 'Nagercoil', broadcaster: 'All India Radio', url: `${AIR}/pbaudio129/playlist.m3u8`, hls: true }
];

/** Tamil FM beyond India: one continuous stream each. */
const TAMIL_ABROAD: LiveRadioStation[] = [
  { id: 'oli-968', name: 'Oli 96.8', place: 'Singapore', broadcaster: 'Mediacorp', frequency: '96.8 FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/OLI968FMAAC.aac' },
  { id: 'minnal-fm', name: 'Minnal FM', place: 'Malaysia', broadcaster: 'RTM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MINNAL_FMAAC.aac' },
  { id: 'shakthi-fm', name: 'Shakthi FM', place: 'Sri Lanka', url: 'https://mbc.thestreamtech.com:8086/stream' },
  { id: 'sooriyan-fm', name: 'Sooriyan FM', place: 'Sri Lanka', url: 'https://radio.lotustechnologieslk.net:8006/;stream.mp3' },
  { id: 'vasantham-fm', name: 'Vasantham FM', place: 'Sri Lanka', url: 'https://cp12.serverse.com/proxy/vasanthamfm?mp=/stream' }
];

export const TAMIL_FM: LiveRadioStation[] = [...AIR_TAMIL, ...TAMIL_ABROAD];

/** The same station, whoever describes it: compared by stream. */
export function sameStation(a: LiveRadioStation | null | undefined, b: LiveRadioStation | null | undefined): boolean {
  return !!a && !!b && a.url === b.url;
}

/**
 * Whether a stream is one the app will play: https, and nothing odd.
 *
 * A station can arrive from the partner's phone, so this is checked before
 * anything is fetched - the app only ever opens a secure stream URL, never a
 * local address or another scheme.
 */
export function isPlayableStreamUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 600) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    // 'localhost.' is localhost too.
    const host = u.hostname.toLowerCase().replace(/\.+$/, '');
    // Never this device or its network.
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith('[')) return false;
    return true;
  } catch {
    return false;
  }
}

/** A station that came from elsewhere (the partner, storage), made safe to use - or null. */
export function cleanStation(s: unknown): LiveRadioStation | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  if (!isPlayableStreamUrl(o.url) || typeof o.name !== 'string' || typeof o.id !== 'string') return null;
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  return {
    id: o.id.slice(0, 120),
    name: o.name.trim().slice(0, 80) || 'Radio',
    url: o.url,
    place: text(o.place, 60),
    broadcaster: text(o.broadcaster, 60),
    frequency: text(o.frequency, 20),
    hls: o.hls === true || /\.m3u8?(\?|$)/i.test(new URL(o.url).pathname),
    starredAt: typeof o.starredAt === 'number' && Number.isFinite(o.starredAt) ? o.starredAt : undefined
  };
}

// ---------------------------------------------------------------- search

const DIRECTORY_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://all.api.radio-browser.info'
];

interface DirectoryStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  state: string;
  country: string;
  codec: string;
  hls: number;
  lastcheckok: number;
}

const PLAYABLE_CODECS = new Set(['MP3', 'AAC', 'AAC+']);

/**
 * Tamil stations matching a name, most listened first. Rejects if no
 * directory server answers. Asks the directory for https streams only, and
 * checks again here.
 */
export async function searchTamilStations(query: string, signal?: AbortSignal): Promise<LiveRadioStation[]> {
  const params = new URLSearchParams({
    language: 'tamil',
    name: query.trim(),
    is_https: 'true',
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    limit: '40'
  });
  let lastError: unknown = null;
  for (const server of DIRECTORY_SERVERS) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 8000);
    const onAbort = () => timeout.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(`${server}/json/stations/search?${params}`, { signal: timeout.signal });
      if (!res.ok) throw new Error(`directory answered ${res.status}`);
      const found = (await res.json()) as DirectoryStation[];
      const seen = new Set(TAMIL_FM.map(s => s.url));
      const out: LiveRadioStation[] = [];
      for (const d of found) {
        if (!d.lastcheckok || !(d.hls === 1 || PLAYABLE_CODECS.has(d.codec))) continue;
        const station = cleanStation({
          id: `rb:${d.stationuuid}`,
          name: d.name,
          url: d.url_resolved || d.url,
          place: d.state || d.country,
          hls: d.hls === 1
        });
        if (!station || seen.has(station.url)) continue;
        seen.add(station.url);
        out.push(station);
      }
      return out;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError ?? new Error('no directory server answered');
}
