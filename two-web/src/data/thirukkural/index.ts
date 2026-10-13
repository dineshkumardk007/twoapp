// The Thirukkural: all 1,330 kurals, for the kural of the day on Home.
//
// Thiruvalluvar's 1,330 couplets in 133 chapters of ten, in three books:
// Virtue (kurals 1-380), Wealth (381-1080) and Love (1081-1330).
//
// Only the parts that are free for anyone to use are here:
//   - the Tamil text and its transliteration
//   - G. U. Pope's verse translation (1886)
//   - the plain translation of W. H. Drew (1840) and J. Lazarus (1885),
//     shown as the meaning
//   - the chapter names, Tamil and English
// Taken from github.com/tk120404/thirukkural (Apache License 2.0, copied
// alongside as LICENSE-tk120404-thirukkural.txt). That collection also
// carries modern commentaries - Mu. Varadarasanar, Kalaignar Karunanidhi,
// Solomon Pappaiah - and Shuddhananda Bharati's translation, which are still
// under copyright and were left out on purpose.
//
// About 600 KB, so it is a separate file, fetched the first time Home shows
// the leaf and never otherwise.

export const KURAL_COUNT = 1330;

/** One kural, with the chapter and book it belongs to. */
export interface Kural {
  number: number;
  line1: string;
  line2: string;
  translit1: string;
  translit2: string;
  /** G. U. Pope's verse translation. */
  pope: string;
  /** Drew & Lazarus's plain translation, shown as the meaning. */
  meaning: string;
  chapter: { number: number; tamil: string; english: string };
  book: { tamil: string; english: string };
}

interface KuralData {
  paals: [string, string][];
  chapters: [number, string, string, number, number, number][];
  kurals: [string, string, string, string, string, string][];
}

let loading: Promise<KuralData> | null = null;

function load(): Promise<KuralData> {
  if (!loading) {
    loading = import('./kurals.json').then(m => (m.default ?? m) as unknown as KuralData);
    // A failed load (it should not, the file ships with the app) is retried
    // next time rather than remembered.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/**
 * The day the reading began: kural 1 on this day, 2 the next, through all
 * 1,330 and round again - the whole book in order, a kural a day. A fixed
 * date rather than one per phone, so both phones read the same kural.
 */
const FIRST_DAY = Date.UTC(2026, 9, 13);
const DAY = 86_400_000;

/** Today's kural number for a local date written 'YYYY-MM-DD'. */
export function kuralNumberFor(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const days = Math.round((Date.UTC(y, (m || 1) - 1, d || 1) - FIRST_DAY) / DAY);
  return (((days % KURAL_COUNT) + KURAL_COUNT) % KURAL_COUNT) + 1;
}

/** One kural by its number, 1 to 1,330. */
export async function getKural(number: number): Promise<Kural> {
  const data = await load();
  const n = Math.min(KURAL_COUNT, Math.max(1, Math.round(number)));
  const [line1, line2, translit1, translit2, pope, meaning] = data.kurals[n - 1];
  const chapter = data.chapters.find(c => n >= c[3] && n <= c[4]) ?? data.chapters[0];
  const book = data.paals[chapter[5] - 1] ?? data.paals[0];
  return {
    number: n,
    line1,
    line2,
    translit1,
    translit2,
    pope,
    meaning,
    chapter: { number: chapter[0], tamil: chapter[1], english: chapter[2] },
    book: { tamil: book[0], english: book[1] }
  };
}
