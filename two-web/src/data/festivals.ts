// Tamil festivals, for "Coming up" on Home.
//
// The dates move every year with the Tamil and lunar calendars, so they are
// written out rather than worked out. Each was checked in two independent
// places - drikpanchang for Chennai (geoname-id 1264527) and prokerala /
// tamildailycalendar for Chennai - and for 2026 against the Tamil Nadu
// government's holiday list (G.O. Ms. No. 708, Gazette Extraordinary 721),
// which settled the two days the calendars put differently (Pongal and
// Ayudha Pooja). Deepavali is the Tamil Nadu day (Naraka Chaturdashi
// morning), which can be a day before the North Indian one.
//
// A year the sources do not agree on is left out rather than guessed: Ayudha
// Pooja 2027 and 2028, Deepavali 2030, Karthigai Deepam 2027 to 2029. In
// those years that festival simply does not show, and nothing is shown past
// 2030, until a newer version of Two adds them.

export interface Festival {
  id: string;
  /** In English, as the card says it. */
  name: string;
  /** In Tamil. */
  tamil: string;
  emoji: string;
  /** The wish "Send a wish" puts in the chat on the day. */
  wish: string;
  /** 'YYYY-MM-DD' for each year known. */
  dates: string[];
}

export const FESTIVALS: readonly Festival[] = [
  {
    id: 'pongal',
    name: 'Pongal',
    tamil: 'பொங்கல்',
    emoji: '🌾',
    wish: 'இனிய பொங்கல் நல்வாழ்த்துகள்! 🌾',
    dates: ['2026-01-15', '2027-01-15', '2028-01-15', '2029-01-14', '2030-01-14']
  },
  {
    id: 'puthandu',
    name: 'Tamil New Year',
    tamil: 'புத்தாண்டு',
    emoji: '🌼',
    wish: 'இனிய தமிழ்ப் புத்தாண்டு நல்வாழ்த்துகள்! 🌼',
    dates: ['2026-04-14', '2027-04-14', '2028-04-14', '2029-04-14', '2030-04-14']
  },
  {
    id: 'vinayagar',
    name: 'Vinayagar Chathurthi',
    tamil: 'விநாயகர் சதுர்த்தி',
    emoji: '🐘',
    wish: 'இனிய விநாயகர் சதுர்த்தி நல்வாழ்த்துகள்! 🐘',
    dates: ['2026-09-14', '2027-09-04', '2028-08-23', '2029-09-11', '2030-09-01']
  },
  {
    id: 'ayudha',
    name: 'Ayudha Pooja',
    tamil: 'ஆயுத பூஜை',
    emoji: '🪔',
    wish: 'இனிய ஆயுத பூஜை நல்வாழ்த்துகள்! 🪔',
    dates: ['2026-10-19', '2029-10-15', '2030-10-05']
  },
  {
    id: 'deepavali',
    name: 'Deepavali',
    tamil: 'தீபாவளி',
    emoji: '🎆',
    wish: 'இனிய தீபாவளி நல்வாழ்த்துகள்! 🎆',
    dates: ['2026-11-08', '2027-10-28', '2028-10-17', '2029-11-05']
  },
  {
    id: 'karthigai',
    name: 'Karthigai Deepam',
    tamil: 'கார்த்திகை தீபம்',
    emoji: '🪔',
    wish: 'இனிய கார்த்திகை தீபத் திருநாள் நல்வாழ்த்துகள்! 🪔',
    dates: ['2026-11-24', '2030-12-08']
  }
];
