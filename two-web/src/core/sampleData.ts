// Removes the sample content earlier versions filled every new space with.
//
// A new space used to open already full: journal entries about burnout, a
// repair letter apologising for snapping at dinner, cycle logs, a consent
// history of things that never happened, a dog called Barnaby. It read as
// the couple's own - and on a phone that has been in real use, it is now
// mixed in with things the two of you actually wrote.
//
// Every sample item is recognised by two things at once: its id, which the
// app itself never generates in that form ('1', 'peb-3', 'cr-2' - real ids
// are random hex), and a piece of its original text. Only when both match is
// it removed, so nothing either of you wrote can be caught by this. Running it
// again changes nothing, which is why it is safe to run on every load.

import type { SpaceState } from './storage';

/** [collection, id, field, a distinctive piece of the sample text]. */
const SAMPLE_ITEMS: Array<[keyof SpaceState, string, string, string]> = [
  ['journalEntries', '1', 'title', 'A quiet sunrise'],
  ['journalEntries', '2', 'title', 'Processing end-of-week burnout'],
  ['agreements', '1', 'title', 'Handling low capacity after work'],
  ['lists', '1', 'title', 'Weekend pottery workshop'],
  ['lists', '2', 'title', 'Watch the animated Japanese feature'],
  ['lists', '3', 'title', 'Surprise weekend cabin trip booking'],
  ['chores', '1', 'task', 'Book car seasonal service'],
  ['chores', '2', 'task', 'Plan weekly dinners & ingredients'],
  ['chores', '3', 'task', 'Order refill on pet medication'],
  ['expenses', '1', 'title', 'Farmers market produce & olive oil'],
  ['expenses', '2', 'title', 'Electricity & heating utility'],
  ['quotes', '3', 'quote', 'drink water today. You are doing so much better'],
  ['consentLogs', '1', 'details', 'Time-boxed 1-hour location ping expired'],
  ['consentLogs', '2', 'details', 'Phase sharing updated to: Luteal Phase'],
  ['consentLogs', '3', 'details', 'Local encrypted database backup exported to JSON'],
  ['cycleRecords', 'cr-1', 'mood', 'Introspective & Sensitive'],
  ['cycleRecords', 'cr-2', 'mood', 'Radiant & Expressive'],
  ['cycleRecords', 'cr-3', 'mood', 'Clear-headed & Motivated'],
  ['pebbles', 'peb-1', 'color', '#D4A373'],
  ['pebbles', 'peb-2', 'color', '#B5A895'],
  ['pebbles', 'peb-3', 'color', '#C48B71'],
  ['pebbles', 'peb-4', 'color', '#8F9E8B'],
  ['pebbles', 'peb-5', 'color', '#938581'],
  ['pebbles', 'peb-6', 'color', '#C9ADA7'],
  ['letters', 'let-1', 'title', 'For Our Next Rainy Sunday Morning'],
  ['letters', 'let-2', 'title', 'A Little Note from 30,000 Feet'],
  ['milestones', 'ms-1', 'title', 'The First Rainy Coffee'],
  ['milestones', 'ms-2', 'title', 'Keys to Our First Apartment'],
  ['milestones', 'ms-3', 'title', 'Adopting Barnaby'],
  ['milestones', 'ms-4', 'title', 'Our 4th Anniversary'],
  ['constellationStars', 'star-1', 'note', 'oat milk in my travel mug'],
  ['constellationStars', 'star-2', 'note', 'Holding my hand quietly under the table'],
  ['constellationStars', 'star-3', 'note', 'fold that fitted sheet together'],
  ['constellationStars', 'star-4', 'note', 'your arm wrapped around me'],
  ['constellationStars', 'star-5', 'note', 'a sunroom full of ferns and books'],
  ['comfortBoxes', 'cb-1', 'reassuranceNote', 'You are more than enough'],
  ['recipes', 'rcp-1', 'title', 'Midnight Garlic Butter Ramen'],
  ['recipes', 'rcp-2', 'title', 'Sunday Brioche French Toast'],
  ['timeCapsules', 'capsule-1', 'title', 'To Our Next Milestone Anniversary'],
  ['timeCapsules', 'capsule-2', 'title', 'Sealed on the Night We Moved In Together'],
  ['scratchCards', 'scratch-1', 'title', 'Warm Scalp & Shoulder Massage Voucher'],
  ['scratchCards', 'scratch-2', 'title', 'Starlight Balcony Dessert Date'],
  ['scratchCards', 'scratch-3', 'title', 'Immunity Pass: Movie Choice Without Veto'],
  ['whisperMemos', 'whisper-1', 'title', 'Morning sunlight on the kitchen floor'],
  ['whisperMemos', 'whisper-2', 'title', 'Midnight rain on the skylight'],
  ['coordinatePins', 'pin-1', 'title', 'Our First Awkward Coffee Date'],
  ['coordinatePins', 'pin-2', 'title', 'The Rooftop Where We Watched the Perseids'],
  ['coordinatePins', 'pin-3', 'title', 'The Seaside Pier at Midnight'],
  ['repairLetters', 'repair-1', 'title', 'Snapping during dinner prep on Tuesday'],
  ['kintsugiMoments', 'kintsugi-1', 'title', 'The 4-Month Long-Distance Summer'],
  ['kintsugiMoments', 'kintsugi-2', 'title', 'The First Apartment Lease Panic'],
  ['kintsugiMoments', 'kintsugi-3', 'title', 'Navigating Family Expectations at the Holidays']
];

const SAMPLE_BLOSSOMS: Array<[string, string]> = [
  ['blossom-1', 'late-night drive to the coast'],
  ['blossom-2', 'warm tea on my desk'],
  ['blossom-3', 'homemade gnocchi']
];

const SAMPLE_GROWTH_LOG: Array<[string, string]> = [
  ['log-1', 'Garden sprouted: Young Japanese Hearth Bonsai took root'],
  ['log-2', 'Sprouted Cherry Blossom: "Our first late-night drive to the coast"'],
  ['log-3', 'Nourished with Morning Dew: Vitality reached 88%']
];

/** The streaks each sample ritual started with, invented rather than earned. */
const SAMPLE_RITUAL_STREAKS: Record<string, number> = { 'r-1': 14, 'r-2': 8, 'r-3': 5, 'r-4': 21, 'r-5': 4 };

const SAMPLE_CARE_NOTES = [
  'Quiet evening together without screens, just vinyl and talking.',
  'Feeling depleted from work; craving verbal reassurance and gentle presence.'
];

export const NEUTRAL_CARE_PROFILE = {
  wordsOfAffirmation: 50,
  qualityTime: 50,
  actsOfService: 50,
  physicalTouch: 50,
  thoughtfulSurprises: 50,
  fuelTankPercent: 50,
  currentCravingNote: '',
  updatedAt: ''
};

export const FRESH_GARDEN = {
  level: 1,
  stageName: 'Hearth Seedling',
  vitality: 50,
  waterLevel: 50,
  sunlightLevel: 50,
  isDormant: false,
  lastNourishedAt: '',
  totalWaterings: 0,
  totalSunbaths: 0,
  blossoms: [],
  growthLog: []
};

const matches = (item: any, id: string, field: string, text: string) =>
  item && item.id === id && typeof item[field] === 'string' && item[field].includes(text);

/**
 * The state with every sample item taken out.
 *
 * `firstTime` is true only the first time this runs on a stored space: the
 * one adjustment that is not safe to repeat - taking the invented head start
 * off a ritual streak - happens then and never again.
 */
export function withoutSampleData(state: SpaceState, firstTime: boolean): SpaceState {
  const next: any = { ...state };

  for (const [collection, id, field, text] of SAMPLE_ITEMS) {
    const list = next[collection];
    if (Array.isArray(list) && list.some((item: any) => matches(item, id, field, text))) {
      next[collection] = list.filter((item: any) => !matches(item, id, field, text));
    }
  }

  // A sample date idea marked as done, with a night the two of you never had.
  if (Array.isArray(next.adventures)) {
    next.adventures = next.adventures.map((a: any) =>
      matches(a, 'adv-1', 'personalNotes', 'We played Rumours on vinyl')
        ? { ...a, isCompleted: false, completedDate: undefined, personalNotes: undefined }
        : a
    );
  }

  // A sample game round, "answered" by a partner who never played it.
  if (Array.isArray(next.intuitionRounds)) {
    next.intuitionRounds = next.intuitionRounds.filter(
      (r: any) => !(r?.id === 'round-1' && r?.dilemma?.id === 'dil-1')
    );
  }

  if (next.careCompass) {
    const reset = (profile: any) =>
      profile && SAMPLE_CARE_NOTES.includes(profile.currentCravingNote) ? { ...NEUTRAL_CARE_PROFILE } : profile;
    next.careCompass = { user: reset(next.careCompass.user), partner: reset(next.careCompass.partner) };
  }

  if (next.hearthGarden) {
    const garden = next.hearthGarden;
    const blossoms = (garden.blossoms || []).filter(
      (b: any) => !SAMPLE_BLOSSOMS.some(([id, text]) => matches(b, id, 'note', text))
    );
    const growthLog = (garden.growthLog || []).filter(
      (l: any) => !SAMPLE_GROWTH_LOG.some(([id, text]) => matches(l, id, 'event', text))
    );
    // Untouched since it was handed out: its progress was never theirs.
    const untouched =
      garden.stageName === 'Young Japanese Hearth Bonsai' && garden.totalWaterings === 14 && garden.totalSunbaths === 11;
    next.hearthGarden = untouched ? { ...FRESH_GARDEN, blossoms, growthLog } : { ...garden, blossoms, growthLog };
  }

  if (next.nightstand) {
    const n = next.nightstand;
    const cleaned = { ...n };
    if (n.userStatus?.goodnightNote === 'Rest well tonight, my love.') {
      cleaned.userStatus = { ...n.userStatus, goodnightNote: undefined };
    }
    if (n.partnerStatus?.goodnightNote === 'Already dreaming. Leaving a quiet kiss on your pillow.') {
      cleaned.partnerStatus = { isSleeping: false };
    }
    if (n.lastMidnightKissNote === 'Soft cheek kiss in the dark') {
      cleaned.lastMidnightKissAt = undefined;
      cleaned.lastMidnightKissFrom = undefined;
      cleaned.lastMidnightKissNote = undefined;
    }
    next.nightstand = cleaned;
  }

  if (next.midnightRadio && Array.isArray(next.midnightRadio.whispers)) {
    const sample = (w: any) => matches(w, 'whisper-radio-1', 'text', 'Listening to the quiet rain with you.');
    if (next.midnightRadio.whispers.some(sample)) {
      next.midnightRadio = {
        ...next.midnightRadio,
        partnerListening: false,
        whispers: next.midnightRadio.whispers.filter((w: any) => !sample(w))
      };
    }
  }

  if (next.activeStateOfUnion?.id === 'sou-current' && next.activeStateOfUnion?.weekLabel === 'Week of Sept 1 - Sept 7') {
    next.activeStateOfUnion = null;
  }

  if (next.sharedCanvas && Array.isArray(next.sharedCanvas.strokes)) {
    const sample = (s: any) => s?.id === 'stroke-1' && s?.color === '#f43f5e' && s?.authorId === 'partner';
    if (next.sharedCanvas.strokes.some(sample)) {
      next.sharedCanvas = { ...next.sharedCanvas, strokes: next.sharedCanvas.strokes.filter((s: any) => !sample(s)) };
    }
  }

  if (firstTime && Array.isArray(next.rituals)) {
    next.rituals = next.rituals.map((r: any) =>
      r && r.id in SAMPLE_RITUAL_STREAKS
        ? { ...r, streakDays: Math.max(0, (Number(r.streakDays) || 0) - SAMPLE_RITUAL_STREAKS[r.id]) }
        : r
    );
  }

  next.sampleDataRemoved = true;
  return next as SpaceState;
}
