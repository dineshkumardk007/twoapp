package app.two.android.core.content

data class LiteraryQuote(
    val id: String,
    val quote: String,
    val author: String,
    val source: String? = null,
    val targetWeather: List<String>,
    val maxCapacityThreshold: Int? = null
)

object LiteraryQuoteLibrary {
    val quotes: List<LiteraryQuote> = listOf(
        LiteraryQuote(
            id = "lq-1",
            quote = "For one human being to love another: that is perhaps the most difficult of all our tasks, the ultimate test and proof, the work for which all other work is but preparation.",
            author = "Rainer Maria Rilke",
            source = "Letters to a Young Poet",
            targetWeather = listOf("CALM", "OVERCAST"),
            maxCapacityThreshold = 3
        ),
        LiteraryQuote(
            id = "lq-2",
            quote = "I cannot fix the hour, or the spot, or the look, or the words, which laid the foundation. It is too long ago. I was in the middle before I knew that I had begun.",
            author = "Jane Austen",
            source = "Pride and Prejudice",
            targetWeather = listOf("SUNNY", "CALM"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-3",
            quote = "We loved with a love that was more than love.",
            author = "Edgar Allan Poe",
            source = "Annabel Lee",
            targetWeather = listOf("CALM", "SUNNY"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-4",
            quote = "I carry your heart with me (I carry it in my heart).",
            author = "E.E. Cummings",
            targetWeather = listOf("CALM", "SUNNY"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-5",
            quote = "In the midst of winter, I found there was, within me, an invincible summer.",
            author = "Albert Camus",
            source = "Return to Tipasa",
            targetWeather = listOf("RAINY", "STORMY", "OVERCAST"),
            maxCapacityThreshold = 2
        ),
        LiteraryQuote(
            id = "lq-6",
            quote = "You do not have to be good. You only have to let the soft animal of your body love what it loves.",
            author = "Mary Oliver",
            source = "Wild Geese",
            targetWeather = listOf("RAINY", "OVERCAST"),
            maxCapacityThreshold = 2
        ),
        LiteraryQuote(
            id = "lq-7",
            quote = "We are all travelers in the wilderness of this world, and the best that we can find in our travels is an honest friend.",
            author = "Robert Louis Stevenson",
            targetWeather = listOf("OVERCAST", "CALM"),
            maxCapacityThreshold = 3
        ),
        LiteraryQuote(
            id = "lq-8",
            quote = "To love and be loved is to feel the sun from both sides.",
            author = "David Viscott",
            targetWeather = listOf("CALM", "SUNNY"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-9",
            quote = "Love does not consist in gazing at each other, but in looking outward together in the same direction.",
            author = "Antoine de Saint-Exupéry",
            source = "Wind, Sand and Stars",
            targetWeather = listOf("CALM", "SUNNY"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-10",
            quote = "Whatever our souls are made of, his and mine are the same.",
            author = "Emily Brontë",
            source = "Wuthering Heights",
            targetWeather = listOf("CALM", "OVERCAST"),
            maxCapacityThreshold = 4
        ),
        LiteraryQuote(
            id = "lq-11",
            quote = "Let there be spaces in your togetherness, and let the winds of the heavens dance between you.",
            author = "Kahlil Gibran",
            source = "The Prophet",
            targetWeather = listOf("CALM", "OVERCAST"),
            maxCapacityThreshold = 4
        ),
        LiteraryQuote(
            id = "lq-12",
            quote = "To be fully seen by somebody, then, and be loved anyhow—this is a human offering that can border on miraculous.",
            author = "Elizabeth Gilbert",
            targetWeather = listOf("CALM", "OVERCAST"),
            maxCapacityThreshold = 4
        ),
        LiteraryQuote(
            id = "lq-13",
            quote = "The soul should always stand ajar, ready to welcome the ecstatic experience.",
            author = "Emily Dickinson",
            targetWeather = listOf("SUNNY", "CALM"),
            maxCapacityThreshold = 5
        ),
        LiteraryQuote(
            id = "lq-14",
            quote = "The best thing to hold onto in life is each other.",
            author = "Audrey Hepburn",
            targetWeather = listOf("RAINY", "OVERCAST", "CALM"),
            maxCapacityThreshold = 2
        ),
        LiteraryQuote(
            id = "lq-15",
            quote = "Be soft. Do not let the world make you hard. Do not let pain make you hate. Do not let the bitterness steal your sweetness.",
            author = "Iain S. Thomas",
            targetWeather = listOf("RAINY", "STORMY"),
            maxCapacityThreshold = 1
        ),
        LiteraryQuote(
            id = "lq-16",
            quote = "There is no charm equal to tenderness of heart.",
            author = "Jane Austen",
            source = "Emma",
            targetWeather = listOf("CALM", "RAINY"),
            maxCapacityThreshold = 3
        )
    )

    fun getResurfacedQuote(weather: String, capacity: Int): LiteraryQuote {
        val matches = quotes.filter { q ->
            if (capacity <= 2 && q.maxCapacityThreshold != null && q.maxCapacityThreshold <= 2) {
                true
            } else {
                q.targetWeather.contains(weather)
            }
        }
        return if (matches.isNotEmpty()) {
            matches.random()
        } else {
            quotes.first()
        }
    }
}
