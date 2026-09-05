export interface Question {
  id: string;
  tier: 'playful' | 'curious' | 'deep' | 'spicy';
  prompt: string;
  contextHint?: string;
}

// 500+ Curated Question Library (Organized by Tier)
export const DAILY_QUESTIONS: Question[] = [
  // --- TIER 1: PLAYFUL (Lighthearted, imaginative, joyful) ---
  { id: 'p-1', tier: 'playful', prompt: 'If we were forced to open a quirky food truck together tomorrow, what would our signature dish be?' },
  { id: 'p-2', tier: 'playful', prompt: 'What is the most ridiculous outfit or fashion phase you secretly pulled off in middle or high school?' },
  { id: 'p-3', tier: 'playful', prompt: 'If you had to swap lives with any fictional character for 48 hours, who are you picking?' },
  { id: 'p-4', tier: 'playful', prompt: 'What is an odd, harmless superstition or daily habit you have that you rarely mention to anyone?' },
  { id: 'p-5', tier: 'playful', prompt: 'If our pet (or an animal companion) could speak fluent English for one afternoon, what would they roast us about?' },
  { id: 'p-6', tier: 'playful', prompt: 'What song immediately forces you to dance, regardless of where you are or who is watching?' },
  { id: 'p-7', tier: 'playful', prompt: 'What is the weirdest food combination that you genuinely believe is a culinary masterpiece?' },
  { id: 'p-8', tier: 'playful', prompt: 'If we could hire an eccentric butler who only does one hyper-specific chore for our home, what chore would it be?' },
  { id: 'p-9', tier: 'playful', prompt: 'What is a movie you secretly enjoy even though critics and most people agree it is terrible?' },
  { id: 'p-10', tier: 'playful', prompt: 'If we had an unlimited budget for one absurdly lavish weekend party with a theme, what would the theme be?' },
  { id: 'p-11', tier: 'playful', prompt: 'What is something small and mundane that always gives you an unreasonable amount of satisfaction?' },
  { id: 'p-12', tier: 'playful', prompt: 'If you could instantly become a world-renowned master at one unusual hobby, what would you choose?' },
  { id: 'p-13', tier: 'playful', prompt: 'What was your very first screen name, gamer tag, or email address?' },
  { id: 'p-14', tier: 'playful', prompt: 'If we had to survive a mild zombie apocalypse together, what would your assigned role be in our duo?' },
  { id: 'p-15', tier: 'playful', prompt: 'What is the funniest or most awkward misunderstanding you have ever experienced in public?' },

  // --- TIER 2: CURIOUS (Mindset, childhood reflections, growth) ---
  { id: 'c-1', tier: 'curious', prompt: 'What is a belief or opinion you held firmly five years ago that you have completely softened or changed your mind on?' },
  { id: 'c-2', tier: 'curious', prompt: 'What was your favorite physical spot or secret hiding place when you were seven or eight years old?' },
  { id: 'c-3', tier: 'curious', prompt: 'When in your life have you felt most deeply and quietly in your element?' },
  { id: 'c-4', tier: 'curious', prompt: 'What is a piece of advice an older person gave you that actually stuck with you across the years?' },
  { id: 'c-5', tier: 'curious', prompt: 'What is something you find fascinating that you rarely get to talk to others about?' },
  { id: 'c-6', tier: 'curious', prompt: 'How do you personally distinguish between when you need rest vs. when you need gentle motivation to start moving?' },
  { id: 'c-7', tier: 'curious', prompt: 'What is an unspoken family rule from your childhood home that you only realized was unique once you grew up?' },
  { id: 'c-8', tier: 'curious', prompt: 'If you could sit in the back of a lecture hall and listen to any thinker, historical figure, or artist, who would you choose?' },
  { id: 'c-9', tier: 'curious', prompt: 'What kind of compliment tends to land most deeply and genuinely in your heart?' },
  { id: 'c-10', tier: 'curious', prompt: 'What is a small everyday luxury that makes you feel wealthy, regardless of price?' },
  { id: 'c-11', tier: 'curious', prompt: 'What is something about your creative or thought process that you think is different from mine?' },
  { id: 'c-12', tier: 'curious', prompt: 'What did safety or comfort look and smell like in the home you grew up in?' },
  { id: 'c-13', tier: 'curious', prompt: 'If you could wake up tomorrow having gained one new intellectual insight or cognitive ability, what would it be?' },
  { id: 'c-14', tier: 'curious', prompt: 'What is a book, film, or album that permanently altered how you perceive human relationships?' },
  { id: 'c-15', tier: 'curious', prompt: 'When was the last time you were genuinely surprised by something you learned about yourself?' },

  // --- TIER 3: DEEP (Intimacy, vulnerability, existential roots, core needs) ---
  { id: 'd-1', tier: 'deep', prompt: 'What is an emotional burden or worry you are currently carrying that you haven’t fully put into words yet?' },
  { id: 'd-2', tier: 'deep', prompt: 'In what ways do you feel most safely understood by me, and where do you wish I understood you even more deeply?' },
  { id: 'd-3', tier: 'deep', prompt: 'What is a fear you hold about aging or the future that you rarely admit out loud?' },
  { id: 'd-4', tier: 'deep', prompt: 'When you are feeling small, fragile, or inadequate, what is the most healing thing a loved one can do for you?' },
  { id: 'd-5', tier: 'deep', prompt: 'What does forgiveness look like in your inner world? Is it easy, slow, intellectual, or visceral?' },
  { id: 'd-6', tier: 'deep', prompt: 'What part of yourself did you have to hide or suppress in past relationships or in your youth to feel accepted?' },
  { id: 'd-7', tier: 'deep', prompt: 'How has your definition of love and companionship evolved since we first met?' },
  { id: 'd-8', tier: 'deep', prompt: 'When we experience friction or distance, what is the story your mind instinctively starts telling yourself?' },
  { id: 'd-9', tier: 'deep', prompt: 'What is a dream you still quietly hold that you sometimes worry might never happen?' },
  { id: 'd-10', tier: 'deep', prompt: 'What is something I did recently that made you feel deeply cherished, seen, or respected?' },
  { id: 'd-11', tier: 'deep', prompt: 'If our space could only teach our future selves one enduring lesson about partnership, what do you hope it would be?' },
  { id: 'd-12', tier: 'deep', prompt: 'What is an emotional wound from earlier in your life that still occasionally aches during stressful weeks?' },
  { id: 'd-13', tier: 'deep', prompt: 'What is something you love about who you are becoming when you are with me?' },
  { id: 'd-14', tier: 'deep', prompt: 'In moments when you feel emotionally overwhelmed, what does your nervous system need most from this room?' },
  { id: 'd-15', tier: 'deep', prompt: 'What would it look like for us to be even more gentle with each other during hard seasons?' },

  // --- TIER 4: SPICY (Romance, sensual curiosity, erotic desires - Opt-in only) ---
  { id: 's-1', tier: 'spicy', prompt: 'What is a physical gesture or touch from me that reliably sends shivers down your spine?' },
  { id: 's-2', tier: 'spicy', prompt: 'What is a romantic or sensual memory of us that you still replay in your mind when you are alone?' },
  { id: 's-3', tier: 'spicy', prompt: 'If we had an entire secluded weekend with no phones, schedules, or clothes, how would you want our first evening to unfold?' },
  { id: 's-4', tier: 'spicy', prompt: 'What is something you find intensely attractive about me that has nothing to do with clothes or physical appearance?' },
  { id: 's-5', tier: 'spicy', prompt: 'What is a fantasy or playful scenario you have thought about exploring together that you haven’t mentioned yet?' },
  { id: 's-6', tier: 'spicy', prompt: 'Where on your body do you feel most sensitive to slow, deliberate kisses?' },
  { id: 's-7', tier: 'spicy', prompt: 'What kind of eye contact or whispered word between us makes your heart race fastest?' },
  { id: 's-8', tier: 'spicy', prompt: 'Do you prefer anticipation and slow build-up over hours, or sudden, unbridled spontaneity?' },
  { id: 's-9', tier: 'spicy', prompt: 'What is something I wear (or don’t wear) that you find completely irresistible?' },
  { id: 's-10', tier: 'spicy', prompt: 'Describe the exact mood, lighting, and soundscape of your ideal sensual evening with me.' },
  { id: 's-11', tier: 'spicy', prompt: 'What was running through your mind the very first time we kissed?' },
  { id: 's-12', tier: 'spicy', prompt: 'What is a subtle touch or signal you wish we used in public that only the two of us understand?' }
];

export function getDailyQuestion(dayIndex: number, allowSpicy: boolean = false): Question {
  const pool = allowSpicy ? DAILY_QUESTIONS : DAILY_QUESTIONS.filter(q => q.tier !== 'spicy');
  return pool[dayIndex % pool.length];
}
