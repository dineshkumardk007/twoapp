package app.two.android

import app.two.android.features.sync.ListenerBackoff
import app.two.android.features.sync.OemSettings
import app.two.android.features.sync.Receipts
import app.two.android.features.sync.RecentIds
import app.two.android.features.sync.SyncMode
import app.two.android.features.sync.checkRoomInput
import app.two.android.features.sync.pickMode
import app.two.android.features.sync.pickStartCursor
import app.two.android.features.sync.receiptsState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The background connection's rules that need no phone (features/sync). */
class BackgroundSyncTest {

    private val space = "0123456789abcdef0123456789abcdef"

    private fun input(
        v: Any? = 1,
        spaceId: Any? = space,
        deviceId: Any? = "device-1",
        seat: Any? = "user",
        since: Any? = 1_730_000_000_000L,
        sinceSeq: Any? = 4211,
        disguised: Any? = false,
        noticeText: Any? = "New message"
    ) = checkRoomInput(v, spaceId, deviceId, seat, since, sinceSeq, disguised, noticeText, "DEFAULT")

    @Test
    fun goodRoomDetailsAreKept() {
        val room = input()
        assertNotNull(room)
        assertEquals(space, room!!.spaceId)
        assertEquals("device-1", room.deviceId)
        assertEquals("user", room.seat)
        assertEquals(1_730_000_000_000L, room.since)
        assertEquals(4211L, room.sinceSeq)
        assertFalse(room.disguised)
        assertEquals("New message", room.noticeText)
    }

    @Test
    fun roomIdMustBeLowerCaseHex() {
        assertNull(input(spaceId = "0123ABCD"))
        assertNull(input(spaceId = "not-hex"))
        assertNull(input(spaceId = ""))
        assertNull(input(spaceId = "a".repeat(129)))
        assertNull(input(spaceId = 1234))
        assertNotNull(input(spaceId = "a".repeat(128)))
    }

    @Test
    fun idAndSeatMustBeThereAndShort() {
        assertNull(input(deviceId = ""))
        assertNull(input(deviceId = "d".repeat(129)))
        assertNull(input(deviceId = null))
        assertNull(input(seat = ""))
        assertNull(input(seat = "s".repeat(65)))
    }

    @Test
    fun cursorsMustBeFiniteAndNotNegative() {
        assertNull(input(since = -1))
        assertNull(input(since = Double.NaN))
        assertNull(input(sinceSeq = Double.POSITIVE_INFINITY))
        assertNull(input(since = "1730000000000"))
        assertNull(input(sinceSeq = null))
        assertEquals(0L, input(since = 0, sinceSeq = 0)!!.since)
    }

    @Test
    fun onlyVersionOneIsRead() {
        assertNull(input(v = 2))
        assertNull(input(v = "1"))
        assertNotNull(input(v = null))
    }

    @Test
    fun noticeTextFallsBackRatherThanLosingTheRoom() {
        assertEquals("DEFAULT", input(noticeText = "")!!.noticeText)
        assertEquals("DEFAULT", input(noticeText = "x".repeat(41))!!.noticeText)
        assertEquals("DEFAULT", input(noticeText = null)!!.noticeText)
        assertEquals("புதிய செய்தி", input(noticeText = "புதிய செய்தி")!!.noticeText)
    }

    @Test
    fun disguisedOnlyWhenTrue() {
        assertTrue(input(disguised = true)!!.disguised)
        assertFalse(input(disguised = "true")!!.disguised)
        assertFalse(input(disguised = null)!!.disguised)
    }

    @Test
    fun listenerStartsPastBothCursors() {
        val start = pickStartCursor(100L, 7L, 250L, 3L, 1_000_000L)
        assertEquals(250L, start.since)
        assertEquals(7L, start.seq)
        assertFalse(start.fallback)
    }

    @Test
    fun noCursorLooksBackTenMinutesAndNeverAsksForEverything() {
        val now = 1_730_000_000_000L
        val start = pickStartCursor(0L, 0L, 0L, 0L, now)
        assertEquals(now - 600_000L, start.since)
        assertEquals(0L, start.seq)
        assertTrue(start.fallback)
        // A seq alone is a cursor.
        assertFalse(pickStartCursor(0L, 5L, 0L, 0L, now).fallback)
    }

    @Test
    fun relayAnswerHoldsSixHours() {
        val sixHours = 6 * 60 * 60 * 1000L
        val at = 1_730_000_000_000L
        assertEquals(Receipts.CHECK, receiptsState(false, 0L, at))
        assertEquals(Receipts.OK, receiptsState(true, at, at + 1))
        assertEquals(Receipts.OLD, receiptsState(false, at, at + sixHours - 1))
        assertEquals(Receipts.CHECK, receiptsState(true, at, at + sixHours))
        assertEquals(Receipts.CHECK, receiptsState(false, at, at + sixHours))
        // A clock that went backwards asks again.
        assertEquals(Receipts.CHECK, receiptsState(true, at, at - 1))
    }

    @Test
    fun modes() {
        assertEquals(SyncMode.OFF, pickMode(hasRoom = false, pageAlive = true, pageRelayOn = true, oldRelay = false))
        assertEquals(SyncMode.PAGE, pickMode(hasRoom = true, pageAlive = true, pageRelayOn = true, oldRelay = true))
        assertEquals(SyncMode.LISTENER, pickMode(hasRoom = true, pageAlive = true, pageRelayOn = false, oldRelay = false))
        assertEquals(SyncMode.LISTENER, pickMode(hasRoom = true, pageAlive = false, pageRelayOn = true, oldRelay = false))
        assertEquals(SyncMode.WAITING, pickMode(hasRoom = true, pageAlive = false, pageRelayOn = false, oldRelay = true))
        assertEquals("waiting", SyncMode.WAITING.wire)
    }

    @Test
    fun handOverWaitsLongerEachTime() {
        assertEquals(listOf(5_000L, 15_000L, 30_000L, 60_000L, 300_000L, 300_000L), (0..5).map { ListenerBackoff.handOverMs(it) })
    }

    @Test
    fun failuresDoubleToFiveMinutes() {
        assertEquals(listOf(1_000L, 2_000L, 4_000L, 8_000L), (0..3).map { ListenerBackoff.failureMs(it) })
        assertEquals(256_000L, ListenerBackoff.failureMs(8))
        assertEquals(300_000L, ListenerBackoff.failureMs(9))
        assertEquals(300_000L, ListenerBackoff.failureMs(100))
        assertEquals(1_000L, ListenerBackoff.failureMs(-1))
    }

    @Test
    fun recentIdsAnswerEachOnceAndForgetTheOldest() {
        val recent = RecentIds(3)
        assertTrue(recent.add("a"))
        assertFalse(recent.add("a"))
        assertTrue(recent.add("b"))
        assertTrue(recent.add("c"))
        assertTrue(recent.add("d"))
        assertEquals(3, recent.size)
        // "a" was the oldest and is gone: seen again, it is new.
        assertTrue(recent.add("a"))
        recent.remove("d")
        assertTrue(recent.add("d"))
    }

    @Test
    fun brandFamilies() {
        assertEquals("xiaomi", OemSettings.family("Xiaomi", "Redmi"))
        assertEquals("xiaomi", OemSettings.family("Xiaomi", "POCO"))
        assertEquals("vivo", OemSettings.family("vivo", "iQOO"))
        assertEquals("oppo", OemSettings.family("OnePlus", "OnePlus"))
        assertEquals("oppo", OemSettings.family("realme", "realme"))
        assertEquals("oppo", OemSettings.family("OPPO", "OPPO"))
        assertEquals("", OemSettings.family("samsung", "samsung"))
        assertEquals("", OemSettings.family(null, null))
    }
}
