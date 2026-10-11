export interface Question {
  id: string;
  tier: 'playful' | 'curious' | 'deep' | 'spicy';
  prompt: string;
  contextHint?: string;
}

// The library, by tier. Today's question walks the whole of it before any
// question comes round again - see questionForDay.
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
  { id: 'p-16', tier: 'playful', prompt: 'What would our couple name be if we were a famous duo?' },
  { id: 'p-17', tier: 'playful', prompt: 'If our relationship had a theme song, what would it be?' },
  { id: 'p-18', tier: 'playful', prompt: 'Guess my answer: what is my go-to comfort food after a long day?' },
  { id: 'p-19', tier: 'playful', prompt: 'What is one thing I do that always makes you laugh, even when you try not to?' },
  { id: 'p-20', tier: 'playful', prompt: 'If we swapped jobs for a day, who would be fired first, and why?' },
  { id: 'p-21', tier: 'playful', prompt: 'What is the most "us" thing we have ever done?' },
  { id: 'p-22', tier: 'playful', prompt: 'If we opened a tiny café together, what would be on the menu, and who would run the till?' },
  { id: 'p-23', tier: 'playful', prompt: 'Which of my habits would you nominate for an award, and what is the award called?' },
  { id: 'p-24', tier: 'playful', prompt: 'What is a word or phrase only the two of us understand?' },
  { id: 'p-25', tier: 'playful', prompt: 'If our story were a film, what genre would it be?' },
  { id: 'p-26', tier: 'playful', prompt: 'What is the silliest argument we have ever had?' },
  { id: 'p-27', tier: 'playful', prompt: 'Guess my answer: if I could eat only one dish for a month, what would it be?' },
  { id: 'p-28', tier: 'playful', prompt: 'What would a perfect lazy Sunday with me look like, hour by hour?' },
  { id: 'p-29', tier: 'playful', prompt: 'If we had a pet together, what would we name it?' },
  { id: 'p-30', tier: 'playful', prompt: 'What is a snack you would never share, not even with me?' },
  { id: 'p-31', tier: 'playful', prompt: 'Which song would you pick for our first dance - or our next one?' },
  { id: 'p-32', tier: 'playful', prompt: 'If you could teleport us anywhere for dinner tonight, where are we eating?' },
  { id: 'p-33', tier: 'playful', prompt: 'Which emoji describes me best, and why?' },
  { id: 'p-34', tier: 'playful', prompt: 'What is a talent of mine that I underrate?' },
  { id: 'p-35', tier: 'playful', prompt: 'If we were on a game show together, what would our strategy be?' },
  { id: 'p-36', tier: 'playful', prompt: 'What is something you have always wanted to try with me but thought sounded silly?' },
  { id: 'p-37', tier: 'playful', prompt: 'Guess my answer: what is the phrase I have said most this month?' },
  { id: 'p-38', tier: 'playful', prompt: 'What would you put in a time capsule of "us" right now?' },
  { id: 'p-39', tier: 'playful', prompt: 'If we had ₹500 and a free weekend with no rules, what would we do?' },
  { id: 'p-40', tier: 'playful', prompt: 'Which fictional couple are we most like?' },
  { id: 'p-41', tier: 'playful', prompt: 'What is the funniest thing I have ever said half-asleep?' },
  { id: 'p-42', tier: 'playful', prompt: 'If our relationship had a weather forecast, what is today\'s forecast?' },
  { id: 'p-43', tier: 'playful', prompt: 'Which chore would you happily do forever if I took one off your list?' },
  { id: 'p-44', tier: 'playful', prompt: 'What would our reality show be called?' },
  { id: 'p-45', tier: 'playful', prompt: 'If we could master one dance style together, which would it be?' },
  { id: 'p-46', tier: 'playful', prompt: 'What is your favourite photo of us, and what was happening just outside the frame?' },
  { id: 'p-47', tier: 'playful', prompt: 'What is a tiny thing I do that you would miss if I stopped?' },
  { id: 'p-48', tier: 'playful', prompt: 'If you planned a surprise day for me with no limits, what is the first stop?' },
  { id: 'p-49', tier: 'playful', prompt: 'Which dish should we learn to cook together next?' },
  { id: 'p-50', tier: 'playful', prompt: 'Which three words would our friends use to describe us as a couple?' },
  { id: 'p-51', tier: 'playful', prompt: 'What is the best gift you have ever received, from anyone?' },
  { id: 'p-52', tier: 'playful', prompt: 'What is one rule you would make if you ran our home for a week?' },
  { id: 'p-53', tier: 'playful', prompt: 'Guess my answer: which season do I love most, and why?' },
  { id: 'p-54', tier: 'playful', prompt: 'If we started a small business tomorrow, what would it be?' },
  { id: 'p-55', tier: 'playful', prompt: 'Which film could you watch with me over and over?' },
  { id: 'p-56', tier: 'playful', prompt: 'What is the most spontaneous thing we have done together?' },
  { id: 'p-57', tier: 'playful', prompt: 'If you could relive one ordinary day with me, which would it be?' },
  { id: 'p-58', tier: 'playful', prompt: 'What would you name a boat if we owned one?' },
  { id: 'p-59', tier: 'playful', prompt: 'If we were stranded on an island, which three things would you pack for us?' },
  { id: 'p-60', tier: 'playful', prompt: 'What surprised you about me after we got together?' },

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
  { id: 'c-16', tier: 'curious', prompt: 'What did you want to be when you grew up, and how much of that is still in you?' },
  { id: 'c-17', tier: 'curious', prompt: 'What is a family tradition you would like us to keep, or start?' },
  { id: 'c-18', tier: 'curious', prompt: 'What is a skill you would love to learn this year?' },
  { id: 'c-19', tier: 'curious', prompt: 'Which teacher or mentor shaped you most, and how?' },
  { id: 'c-20', tier: 'curious', prompt: 'What does a really good day look like for you right now?' },
  { id: 'c-21', tier: 'curious', prompt: 'What is something you have changed your mind about since we met?' },
  { id: 'c-22', tier: 'curious', prompt: 'What is a place from your childhood you would love to show me?' },
  { id: 'c-23', tier: 'curious', prompt: 'Which of your friends understands you best, and why?' },
  { id: 'c-24', tier: 'curious', prompt: 'What does "home" mean to you?' },
  { id: 'c-25', tier: 'curious', prompt: 'What is one small habit that has made your life better?' },
  { id: 'c-26', tier: 'curious', prompt: 'What is a question you wish people asked you more often?' },
  { id: 'c-27', tier: 'curious', prompt: 'How do you like to be looked after when you are unwell?' },
  { id: 'c-28', tier: 'curious', prompt: 'What is a memory with your family that always makes you smile?' },
  { id: 'c-29', tier: 'curious', prompt: 'What is something you are proud of that you rarely talk about?' },
  { id: 'c-30', tier: 'curious', prompt: 'What is a book or film you would like us to share?' },
  { id: 'c-31', tier: 'curious', prompt: 'If you had a free month with no responsibilities, how would you spend it?' },
  { id: 'c-32', tier: 'curious', prompt: 'What is a fear you have overcome, and how did you do it?' },
  { id: 'c-33', tier: 'curious', prompt: 'Which festival or celebration feels most special to you, and why?' },
  { id: 'c-34', tier: 'curious', prompt: 'What is something you would like to get better at in how we talk?' },
  { id: 'c-35', tier: 'curious', prompt: 'What would your younger self find most surprising about your life now?' },
  { id: 'c-36', tier: 'curious', prompt: 'What is a city or country you would like to live in for a while?' },
  { id: 'c-37', tier: 'curious', prompt: 'What is the kindest thing a stranger has ever done for you?' },
  { id: 'c-38', tier: 'curious', prompt: 'What is a way you recharge that I might not know about?' },
  { id: 'c-39', tier: 'curious', prompt: 'Which age of your life so far was the most fun, and why?' },
  { id: 'c-40', tier: 'curious', prompt: 'What is one thing you would like us to do more of this year?' },
  { id: 'c-41', tier: 'curious', prompt: 'What did you think of me the first time we met?' },
  { id: 'c-42', tier: 'curious', prompt: 'What is a food that reminds you of someone you love?' },
  { id: 'c-43', tier: 'curious', prompt: 'What is an opinion you hold that most people around you do not?' },
  { id: 'c-44', tier: 'curious', prompt: 'What is the best advice you have ever ignored?' },
  { id: 'c-45', tier: 'curious', prompt: 'Who do you admire for how they love their partner?' },
  { id: 'c-46', tier: 'curious', prompt: 'What is a goal you would love my help with?' },
  { id: 'c-47', tier: 'curious', prompt: 'How do you know when you need time alone?' },
  { id: 'c-48', tier: 'curious', prompt: 'What did you used to love that you would like to bring back into your life?' },
  { id: 'c-49', tier: 'curious', prompt: 'How would you like our home to feel when people walk in?' },
  { id: 'c-50', tier: 'curious', prompt: 'What is a small decision you made that changed a lot?' },
  { id: 'c-51', tier: 'curious', prompt: 'Which song takes you straight back to one particular moment?' },
  { id: 'c-52', tier: 'curious', prompt: 'What do you love about the place you grew up?' },
  { id: 'c-53', tier: 'curious', prompt: 'What have you been curious about lately?' },
  { id: 'c-54', tier: 'curious', prompt: 'What tradition would you like us to start for our anniversary?' },
  { id: 'c-55', tier: 'curious', prompt: 'What does a perfect weekend morning look like for you?' },
  { id: 'c-56', tier: 'curious', prompt: 'What is one thing you would like to understand better about my family?' },
  { id: 'c-57', tier: 'curious', prompt: 'What is a risk you are glad you took?' },
  { id: 'c-58', tier: 'curious', prompt: 'Which of your traits came from your mother, and which from your father?' },
  { id: 'c-59', tier: 'curious', prompt: 'What is the most beautiful place you have ever been?' },
  { id: 'c-60', tier: 'curious', prompt: 'What are you looking forward to most this month?' },

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
  { id: 'd-16', tier: 'deep', prompt: 'When do you feel closest to me?' },
  { id: 'd-17', tier: 'deep', prompt: 'What is something you need from me but find hard to ask for?' },
  { id: 'd-18', tier: 'deep', prompt: 'What is a moment when you felt really proud of us?' },
  { id: 'd-19', tier: 'deep', prompt: 'What does feeling safe with someone mean to you?' },
  { id: 'd-20', tier: 'deep', prompt: 'What is one thing you wish I knew about how you handle stress?' },
  { id: 'd-21', tier: 'deep', prompt: 'How do you like to make up after a disagreement?' },
  { id: 'd-22', tier: 'deep', prompt: 'What is a promise you would like us to make to each other this year?' },
  { id: 'd-23', tier: 'deep', prompt: 'What part of our future are you most excited about?' },
  { id: 'd-24', tier: 'deep', prompt: 'What is something you have forgiven yourself for?' },
  { id: 'd-25', tier: 'deep', prompt: 'When have you felt most supported by me?' },
  { id: 'd-26', tier: 'deep', prompt: 'What does a healthy argument look like to you?' },
  { id: 'd-27', tier: 'deep', prompt: 'What do you hope for us five years from now?' },
  { id: 'd-28', tier: 'deep', prompt: 'What is something about your past you would like me to understand better?' },
  { id: 'd-29', tier: 'deep', prompt: 'What makes you feel respected in a relationship?' },
  { id: 'd-30', tier: 'deep', prompt: 'What small way of showing love would mean a lot to you right now?' },
  { id: 'd-31', tier: 'deep', prompt: 'What do you think our biggest strength as a couple is?' },
  { id: 'd-32', tier: 'deep', prompt: 'What are you still learning about loving someone?' },
  { id: 'd-33', tier: 'deep', prompt: 'When you imagine us old together, what do you see?' },
  { id: 'd-34', tier: 'deep', prompt: 'What is a value you hope we never lose?' },
  { id: 'd-35', tier: 'deep', prompt: 'What has being with me taught you about yourself?' },
  { id: 'd-36', tier: 'deep', prompt: 'What have you been carrying alone that you could share with me?' },
  { id: 'd-37', tier: 'deep', prompt: 'What does "enough" look like for you - time, money, rest?' },
  { id: 'd-38', tier: 'deep', prompt: 'How has your idea of a good relationship changed over the years?' },
  { id: 'd-39', tier: 'deep', prompt: 'What do you want to be remembered for?' },
  { id: 'd-40', tier: 'deep', prompt: 'When did you last feel misunderstood, and what would have helped?' },
  { id: 'd-41', tier: 'deep', prompt: 'How would you like us to grow together this year?' },
  { id: 'd-42', tier: 'deep', prompt: 'What is a feeling you find hard to show?' },
  { id: 'd-43', tier: 'deep', prompt: 'What does trust look like on an ordinary day?' },
  { id: 'd-44', tier: 'deep', prompt: 'What would you like to thank me for that you have not yet?' },
  { id: 'd-45', tier: 'deep', prompt: 'When you are sad, do you want company, distraction or space?' },
  { id: 'd-46', tier: 'deep', prompt: 'What part of yourself are you working on right now?' },
  { id: 'd-47', tier: 'deep', prompt: 'What is a dream you have let go of, and how do you feel about it now?' },
  { id: 'd-48', tier: 'deep', prompt: 'What do we do better together than apart?' },
  { id: 'd-49', tier: 'deep', prompt: 'What always reassures you when you feel unsure about us?' },
  { id: 'd-50', tier: 'deep', prompt: 'What kind of person do you hope to be for the younger ones in our family?' },
  { id: 'd-51', tier: 'deep', prompt: 'What is a boundary that matters a lot to you?' },
  { id: 'd-52', tier: 'deep', prompt: 'How do you want to be loved on your worst days?' },
  { id: 'd-53', tier: 'deep', prompt: 'What about us do you never want to take for granted?' },
  { id: 'd-54', tier: 'deep', prompt: 'What is a hard season we came through, and what got us through it?' },
  { id: 'd-55', tier: 'deep', prompt: 'What would you like more of from me - words, time, touch, help or surprises?' },
  { id: 'd-56', tier: 'deep', prompt: 'What is a question you have been afraid to ask me?' },
  { id: 'd-57', tier: 'deep', prompt: 'What does commitment mean to you, in everyday terms?' },
  { id: 'd-58', tier: 'deep', prompt: 'What do you admire about how I handle life?' },
  { id: 'd-59', tier: 'deep', prompt: 'What do you need more of in your life right now?' },
  { id: 'd-60', tier: 'deep', prompt: 'What is one thing you hope I always remember about how much you love me?' },

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
  { id: 's-12', tier: 'spicy', prompt: 'What is a subtle touch or signal you wish we used in public that only the two of us understand?' },
  { id: 's-13', tier: 'spicy', prompt: 'What is the most romantic thing I have ever done for you?' },
  { id: 's-14', tier: 'spicy', prompt: 'Where would you love to be kissed that you have never told me?' },
  { id: 's-15', tier: 'spicy', prompt: 'Which outfit of mine do you secretly hope I wear more often?' },
  { id: 's-16', tier: 'spicy', prompt: 'What date would you plan if you knew I would say yes to anything?' },
  { id: 's-17', tier: 'spicy', prompt: 'What time of day do you feel most drawn to me?' },
  { id: 's-18', tier: 'spicy', prompt: 'What is a compliment about my body you have never said out loud?' },
  { id: 's-19', tier: 'spicy', prompt: 'Describe a perfect slow evening together, from dinner to lights out.' },
  { id: 's-20', tier: 'spicy', prompt: 'What is one thing I do that makes you want to kiss me straight away?' },
  { id: 's-21', tier: 'spicy', prompt: 'Where have you daydreamed about us being alone?' },
  { id: 's-22', tier: 'spicy', prompt: 'Do you prefer being surprised with romance, or planning it together?' },
  { id: 's-23', tier: 'spicy', prompt: 'What scent, song or texture puts you in the mood?' },
  { id: 's-24', tier: 'spicy', prompt: 'What is the most attractive thing about the way I look at you?' },
  { id: 's-25', tier: 'spicy', prompt: 'If we had one night in a hotel with no phones, what is the first thing you would want?' },
  { id: 's-26', tier: 'spicy', prompt: 'Which memory of us do you think about when you miss me?' },
  { id: 's-27', tier: 'spicy', prompt: 'What is something new you would like us to try together, romantically?' },
  { id: 's-28', tier: 'spicy', prompt: 'How do you like to be held when you are tired but still want closeness?' },
  { id: 's-29', tier: 'spicy', prompt: 'What message would you love to get from me in the middle of a workday?' },
  { id: 's-30', tier: 'spicy', prompt: 'What is the best kiss we have ever had, and why?' },
  { id: 's-31', tier: 'spicy', prompt: 'Which of my habits do you find unexpectedly attractive?' },
  { id: 's-32', tier: 'spicy', prompt: 'What fantasy date would make you feel completely spoiled?' },
  { id: 's-33', tier: 'spicy', prompt: 'What do you find most irresistible about my voice?' },
  { id: 's-34', tier: 'spicy', prompt: 'Morning closeness or late-night closeness - which do you prefer, and why?' },
  { id: 's-35', tier: 'spicy', prompt: 'What would you like me to whisper to you more often?' },
  { id: 's-36', tier: 'spicy', prompt: 'What is one way I could make you feel more desired this week?' },
  { id: 's-37', tier: 'spicy', prompt: 'What romantic tradition would you love us to have?' },
  { id: 's-38', tier: 'spicy', prompt: 'What about our closeness do you never want to change?' },
  { id: 's-39', tier: 'spicy', prompt: 'What is the most flirtatious thing you have wanted to say to me but did not?' },
  { id: 's-40', tier: 'spicy', prompt: 'What makes you feel most confident and attractive when you are with me?' }
];

/** A question by its id, or undefined for one this version does not have. */
export function questionById(id: string): Question | undefined {
  return DAILY_QUESTIONS.find(q => q.id === id);
}

const EVERYDAY = DAILY_QUESTIONS.filter(q => q.tier !== 'spicy');
const SPICY = DAILY_QUESTIONS.filter(q => q.tier === 'spicy');

/** A local day, 'YYYY-MM-DD', as a whole number of days - no clock involved. */
function dayOrdinal(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const n = Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * The day's question from a pool.
 *
 * It used to be picked by the day of the month, so the same question came
 * back on the same date every month and nothing past the 31st in the list was
 * ever asked. A step through the pool that shares no factor with its size
 * visits every question once before repeating, and a step this wide moves
 * between the tiers rather than spending a fortnight on one of them.
 */
function pickForDay(pool: Question[], day: string): Question {
  const n = pool.length;
  const step = [37, 41, 43, 47, 53].find(s => gcd(s, n) === 1) ?? 1;
  return pool[((dayOrdinal(day) % n) * step) % n];
}

/**
 * Today's question - the same on both phones, since it comes from the date
 * alone. Each day has an everyday one and a spicy one; the spicy one is shown
 * only when asked for, and is its own question to answer.
 */
export function questionForDay(day: string, spicy = false): Question {
  return pickForDay(spicy ? SPICY : EVERYDAY, day);
}
