package app.two.android.core.content

data class DeckCard(
    val id: String,
    val prompt: String,
    val subtext: String? = null
)

data class ConversationDeck(
    val id: String,
    val title: String,
    val description: String,
    val cards: List<DeckCard>
)

object DeckLibrary {
    val decks: List<ConversationDeck> = listOf(
        ConversationDeck(
            id = "deck-know-me",
            title = "How Well Do You Know Me?",
            description = "Playful prompts testing your intuitive knowledge of your partner’s inner world.",
            cards = listOf(
                DeckCard("km-1", "What is my favorite sensory memory of us from this past year?"),
                DeckCard("km-2", "When I am quietly stressed, what is the very first physical tell I exhibit?"),
                DeckCard("km-3", "If I could suddenly take a three-month sabbatical to master any craft, what would I choose?"),
                DeckCard("km-4", "What is a small, irrational fear I have that always makes you smile?"),
                DeckCard("km-5", "What would my ideal lazy Sunday morning look like down to the exact beverage and breakfast?"),
                DeckCard("km-6", "What is a song that instantly reminds you of me when it plays unexpectedly?"),
                DeckCard("km-7", "If I could replay one single day from our entire relationship, which day do you think I would pick?"),
                DeckCard("km-8", "What is a compliment you gave me that I visibly cherished the most?")
            )
        ),
        ConversationDeck(
            id = "deck-vulnerability",
            title = "Vulnerability & Soft Spots",
            description = "Gentle, tender questions to explore emotional safety and unspoken feelings.",
            cards = listOf(
                DeckCard("vs-1", "What is something you find hard to ask for in our relationship, even though you trust me?"),
                DeckCard("vs-2", "When do you feel most emotionally vulnerable or exposed around me?"),
                DeckCard("vs-3", "What is an insecure thought you sometimes battle that you wish I could dispel for you?"),
                DeckCard("vs-4", "In what ways do you feel you have grown softer or more open since we began sharing life?"),
                DeckCard("vs-5", "What is an emotional boundary you had to learn the hard way before we met?"),
                DeckCard("vs-6", "What does genuine emotional safety feel like in your chest and shoulders when we are together?"),
                DeckCard("vs-7", "What is something you wish I noticed without you having to point it out?"),
                DeckCard("vs-8", "If you could give your younger self one reassurance about love, what would it be?")
            )
        ),
        ConversationDeck(
            id = "deck-future",
            title = "Future Visions & Shared Dreams",
            description = "Aligning on life design, home, creative aspirations, and growing old together.",
            cards = listOf(
                DeckCard("fv-1", "What is one tradition or ritual you want us to invent and practice together every year?"),
                DeckCard("fv-2", "When we are 75 years old sitting on a quiet porch, what do you hope we look back on and laugh about?"),
                DeckCard("fv-3", "What kind of home environment do you want us to cultivate for anyone who walks through our door?"),
                DeckCard("fv-4", "What is a bold, slightly frightening adventure you still want to embark on with me?"),
                DeckCard("fv-5", "How do you hope our communication deepens over the next five years?"),
                DeckCard("fv-6", "What is a skill or shared project you want us to build with our hands together?"),
                DeckCard("fv-7", "If we could take a one-year sabbatical living in a coastal village or mountain cabin, where would we go?"),
                DeckCard("fv-8", "What does a truly meaningful, successful life look like to you ten years from now?")
            )
        ),
        ConversationDeck(
            id = "deck-touch",
            title = "Sensory, Touch & Closeness",
            description = "Affection, romantic intimacy, physical presence, and tender closeness.",
            cards = listOf(
                DeckCard("st-1", "What is your favorite everyday physical touch from me (e.g. hand on lower back, head scratch, hug)?"),
                DeckCard("st-2", "How does your body immediately tell you when you are feeling touched-out vs. touch-starved?"),
                DeckCard("st-3", "What is a scent, fabric, or ambient light that instantly puts you in a romantic or relaxed mood?"),
                DeckCard("st-4", "Describe the feeling of our hugs when we haven’t seen each other all day."),
                DeckCard("st-5", "What is a physical feature of mine you find yourself admiring when you think I’m not looking?"),
                DeckCard("st-6", "What kind of kiss speaks most directly to your heart: slow forehead, playful cheek, or lingering lips?"),
                DeckCard("st-7", "What does bedtime physical closeness look like for you when you are deeply exhausted?"),
                DeckCard("st-8", "What is something physical you want us to do more often (e.g. slow dancing in the kitchen, massage, long walks)?")
            )
        )
    )
}
