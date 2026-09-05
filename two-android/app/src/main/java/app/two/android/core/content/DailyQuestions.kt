package app.two.android.core.content

enum class QuestionTier {
    PLAYFUL,
    CURIOUS,
    DEEP,
    SPICY
}

data class DailyQuestion(
    val id: String,
    val tier: QuestionTier,
    val prompt: String,
    val contextHint: String? = null
)

object QuestionLibrary {
    val questions: List<DailyQuestion> = listOf(
        // --- TIER 1: PLAYFUL ---
        DailyQuestion("p-1", QuestionTier.PLAYFUL, "If we were forced to open a quirky food truck together tomorrow, what would our signature dish be?"),
        DailyQuestion("p-2", QuestionTier.PLAYFUL, "What is the most ridiculous outfit or fashion phase you secretly pulled off in middle or high school?"),
        DailyQuestion("p-3", QuestionTier.PLAYFUL, "If you had to swap lives with any fictional character for 48 hours, who are you picking?"),
        DailyQuestion("p-4", QuestionTier.PLAYFUL, "What is an odd, harmless superstition or daily habit you have that you rarely mention to anyone?"),
        DailyQuestion("p-5", QuestionTier.PLAYFUL, "If our pet (or an animal companion) could speak fluent English for one afternoon, what would they roast us about?"),
        DailyQuestion("p-6", QuestionTier.PLAYFUL, "What song immediately forces you to dance, regardless of where you are or who is watching?"),
        DailyQuestion("p-7", QuestionTier.PLAYFUL, "What is the weirdest food combination that you genuinely believe is a culinary masterpiece?"),
        DailyQuestion("p-8", QuestionTier.PLAYFUL, "If we could hire an eccentric butler who only does one hyper-specific chore for our home, what chore would it be?"),
        DailyQuestion("p-9", QuestionTier.PLAYFUL, "What is a movie you secretly enjoy even though critics and most people agree it is terrible?"),
        DailyQuestion("p-10", QuestionTier.PLAYFUL, "If we had an unlimited budget for one absurdly lavish weekend party with a theme, what would the theme be?"),
        DailyQuestion("p-11", QuestionTier.PLAYFUL, "What is something small and mundane that always gives you an unreasonable amount of satisfaction?"),
        DailyQuestion("p-12", QuestionTier.PLAYFUL, "If you could instantly become a world-renowned master at one unusual hobby, what would you choose?"),
        DailyQuestion("p-13", QuestionTier.PLAYFUL, "What was your very first screen name, gamer tag, or email address?"),
        DailyQuestion("p-14", QuestionTier.PLAYFUL, "If we had to survive a mild zombie apocalypse together, what would your assigned role be in our duo?"),
        DailyQuestion("p-15", QuestionTier.PLAYFUL, "What is the funniest or most awkward misunderstanding you have ever experienced in public?"),
        DailyQuestion("p-16", QuestionTier.PLAYFUL, "What board game or card game makes you unexpectedly hyper-competitive?"),
        DailyQuestion("p-17", QuestionTier.PLAYFUL, "If you had to change your first name to any fruit or vegetable, what are you going with?"),
        DailyQuestion("p-18", QuestionTier.PLAYFUL, "What is a celebrity impression you believe you do decently, even if nobody else agrees?"),
        DailyQuestion("p-19", QuestionTier.PLAYFUL, "If our living room had a secret revolving bookcase, what room would be hidden behind it?"),
        DailyQuestion("p-20", QuestionTier.PLAYFUL, "What is the most chaotic purchase you have ever made that you don't entirely regret?"),

        // --- TIER 2: CURIOUS ---
        DailyQuestion("c-1", QuestionTier.CURIOUS, "What is a belief or opinion you held firmly five years ago that you have completely softened or changed your mind on?"),
        DailyQuestion("c-2", QuestionTier.CURIOUS, "What was your favorite physical spot or secret hiding place when you were seven or eight years old?"),
        DailyQuestion("c-3", QuestionTier.CURIOUS, "When in your life have you felt most deeply and quietly in your element?"),
        DailyQuestion("c-4", QuestionTier.CURIOUS, "What is a piece of advice an older person gave you that actually stuck with you across the years?"),
        DailyQuestion("c-5", QuestionTier.CURIOUS, "What is something you find fascinating that you rarely get to talk to others about?"),
        DailyQuestion("c-6", QuestionTier.CURIOUS, "How do you personally distinguish between when you need rest vs. when you need gentle motivation to start moving?"),
        DailyQuestion("c-7", QuestionTier.CURIOUS, "What is an unspoken family rule from your childhood home that you only realized was unique once you grew up?"),
        DailyQuestion("c-8", QuestionTier.CURIOUS, "If you could sit in the back of a lecture hall and listen to any thinker, historical figure, or artist, who would you choose?"),
        DailyQuestion("c-9", QuestionTier.CURIOUS, "What kind of compliment tends to land most deeply and genuinely in your heart?"),
        DailyQuestion("c-10", QuestionTier.CURIOUS, "What is a small everyday luxury that makes you feel wealthy, regardless of price?"),
        DailyQuestion("c-11", QuestionTier.CURIOUS, "What is something about your creative or thought process that you think is different from mine?"),
        DailyQuestion("c-12", QuestionTier.CURIOUS, "What did safety or comfort look and smell like in the home you grew up in?"),
        DailyQuestion("c-13", QuestionTier.CURIOUS, "If you could wake up tomorrow having gained one new intellectual insight or cognitive ability, what would it be?"),
        DailyQuestion("c-14", QuestionTier.CURIOUS, "What is a book, film, or album that permanently altered how you perceive human relationships?"),
        DailyQuestion("c-15", QuestionTier.CURIOUS, "When was the last time you were genuinely surprised by something you learned about yourself?"),

        // --- TIER 3: DEEP ---
        DailyQuestion("d-1", QuestionTier.DEEP, "What is an emotional burden or worry you are currently carrying that you haven’t fully put into words yet?"),
        DailyQuestion("d-2", QuestionTier.DEEP, "In what moments with me do you feel safest to drop all your defenses?"),
        DailyQuestion("d-3", QuestionTier.DEEP, "What is a fear you hold about growing older, and what is something you deeply look forward to?"),
        DailyQuestion("d-4", QuestionTier.DEEP, "When you feel overwhelmed or disconnected from yourself, what is the kindest thing I can do for you?"),
        DailyQuestion("d-5", QuestionTier.DEEP, "What is a part of your personality that you used to hide from people, but now feel at peace with?"),
        DailyQuestion("d-6", QuestionTier.DEEP, "What does forgiveness feel like in your body when you choose to let go of resentment?"),
        DailyQuestion("d-7", QuestionTier.DEEP, "How has our relationship transformed the way you love or receive love compared to your past?"),
        DailyQuestion("d-8", QuestionTier.DEEP, "What is something I did or said recently that made you feel deeply seen and cherished?"),
        DailyQuestion("d-9", QuestionTier.DEEP, "What is a dream or personal ambition that you are slightly hesitant to share out loud because it feels so tender?"),
        DailyQuestion("d-10", QuestionTier.DEEP, "If you could ask me to understand one nuance about your mind without having to explain it, what would it be?"),
        DailyQuestion("d-11", QuestionTier.DEEP, "What is an emotional wound from earlier in life that you feel is still slowly mending?"),
        DailyQuestion("d-12", QuestionTier.DEEP, "What does true intimacy mean to you beyond physical or emotional presence?"),
        DailyQuestion("d-13", QuestionTier.DEEP, "When we are quiet together without speaking, what usually goes through your mind?"),
        DailyQuestion("d-14", QuestionTier.DEEP, "What is something you are proud of surviving or overcoming that you rarely give yourself credit for?"),
        DailyQuestion("d-15", QuestionTier.DEEP, "What legacy or atmosphere do you hope our space radiates to the people whose lives we touch?"),

        // --- TIER 4: SPICY (Mutual Opt-in Only) ---
        DailyQuestion("s-1", QuestionTier.SPICY, "What is a physical gesture or touch from me that reliably sends shivers down your spine?"),
        DailyQuestion("s-2", QuestionTier.SPICY, "What is a romantic or sensual memory of us that you still replay in your mind when you are alone?"),
        DailyQuestion("s-3", QuestionTier.SPICY, "If we had an entire secluded weekend with no phones, schedules, or clothes, how would you want our first evening to unfold?"),
        DailyQuestion("s-4", QuestionTier.SPICY, "What is something you find intensely attractive about me that has nothing to do with clothes or physical appearance?"),
        DailyQuestion("s-5", QuestionTier.SPICY, "What is a fantasy or playful scenario you have thought about exploring together that you haven’t mentioned yet?"),
        DailyQuestion("s-6", QuestionTier.SPICY, "Where on your body do you feel most sensitive to slow, deliberate kisses?"),
        DailyQuestion("s-7", QuestionTier.SPICY, "What kind of eye contact or whispered word between us makes your heart race fastest?"),
        DailyQuestion("s-8", QuestionTier.SPICY, "Do you prefer anticipation and slow build-up over hours, or sudden, unbridled spontaneity?"),
        DailyQuestion("s-9", QuestionTier.SPICY, "What is something I wear (or don’t wear) that you find completely irresistible?"),
        DailyQuestion("s-10", QuestionTier.SPICY, "Describe the exact mood, lighting, and soundscape of your ideal sensual evening with me?"),
        DailyQuestion("s-11", QuestionTier.SPICY, "What was running through your mind the very first time we kissed?"),
        DailyQuestion("s-12", QuestionTier.SPICY, "What is a subtle touch or signal you wish we used in public that only the two of us understand?")
    )

    fun getDailyQuestion(dayOfYear: Int, allowSpicy: Boolean = false): DailyQuestion {
        val pool = if (allowSpicy) questions else questions.filter { it.tier != QuestionTier.SPICY }
        val index = (dayOfYear % pool.size).coerceAtLeast(0)
        return pool[index]
    }
}
