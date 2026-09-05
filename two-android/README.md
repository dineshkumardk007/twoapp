# Two — Native Android Application (Private, Encrypted Space)

**Two** is an end-to-end encrypted relational sanctuary designed for two people to cultivate emotional intimacy, communicate without surveillance, and navigate shared lives without algorithmic manipulation.

---

## Key Highlights & Architectural Features

1. **Zero-Knowledge Cryptographic Core (`core/crypto`)**
   - **Master Key:** Derived on device from passphrase via Argon2id. Never leaves device memory unencrypted.
   - **Hardware Key Isolation:** Android Keystore (StrongBox / TEE) hardware wrapping keys (AES-256-GCM) protecting database keys and secret caches.
   - **Content Encryption:** XChaCha20-Poly1305 AEAD with 192-bit fresh nonces and Additional Authenticated Data (AAD) binding (`record_id || space_id || record_type`) preventing record-swapping attacks.
   - **Domain Subkey Separation:** Distinct cryptographic subkeys for Chat, Journal, Mood, Agreements, Media, and Calendar.
   - **Owner-Only Subkey:** Private journal drafts use a unique subkey that the partner's device cannot derive, enabling safe private reflection before one-tap sharing.

2. **Dual-Track Recovery System**
   - **Path 1 (Autonomous):** 12-word BIP-39 mnemonic phrase generated at signup.
   - **Path 2 (Partner-Assisted Relational Fail-Safe):** In-person notarized QR re-sealing flow. If one partner loses their phrase and phone, the other partner's device can re-seal the space key to a new identity key in person.

3. **Offline-First Local Sync Engine (`core/sync`)**
   - Encrypted Room SQLite database.
   - Immediate optimistic UI commits + background offline write queue.
   - Monotonic Lamport clocks with Last-Write-Wins (LWW) conflict resolution.
   - Collaborative lists powered by an operation-based LWW-Element-Set CRDT.

4. **Emotional Intimacy & Relational Tools (`features/`)**
   - **Emotional Weather Report:** Combines mood valence with an explicit **0 to 5 Emotional Capacity Number**.
   - **"It's Not About You" Flag:** Single-tap de-escalation banner to eliminate tone anxiety and overthinking.
   - **Ask-For-What-You-Need Menu:** Structured requests replacing vague conflict (*Listen without fixing*, *Help me solve this*, *Physical comfort*, *Space for two hours*, *Just sit with me*).
   - **Conflict Repair Kit:** 5-step protocol featuring agreed cool-down timer, private scaffolding reflection prompts, simultaneous cryptographic reveal, and a permanent **Searchable Agreement Log**.
   - **Shared & Private Journal:** Personal private drafts with 1-tap promotion to the shared feed.
   - **Collaborative Lists & Chore Split:** Track invisible household planning vs physical execution. Per-item surprise gift toggle ("Hide from partner").
   - **Money-Light:** Minimal running balance and 1-tap settle-up with zero banking integrations.
   - **Jetpack Glance Home Screen Widget:** Partner mood, capacity dots gauge, and unread note indicators.

5. **Exit-Safe Architecture & Non-Surveillance**
   - `FLAG_SECURE` window protection blocking screenshots and obscuring previews in the app switcher.
   - Biometric App Lock (`BiometricPrompt`) with idle background timeouts.
   - Transparent, bidirectional **Consent Audit Log** for location, cycle, and export events.
   - **Emergency Quick Exit:** Single-tap silent local wipe and key shredding with no alarm sent to the partner.

---

## Project Structure

```
two-android/
├── app/
│   ├── build.gradle.kts
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/app/two/android/
│   │   │   │   ├── TwoApplication.kt
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── core/
│   │   │   │   │   ├── crypto/ (CryptoEngine, KeystoreManager, Bip39Mnemonic, SafetyNumberGenerator)
│   │   │   │   │   ├── database/ (AppDatabase, Entities, Daos, Converters)
│   │   │   │   │   ├── sync/ (SyncEngine, SyncWorker)
│   │   │   │   │   ├── security/ (BiometricAuthManager, SecurityWindowManager, ExitSafeManager)
│   │   │   │   │   └── theme/ (Color, Type, Theme tokens)
│   │   │   │   ├── features/
│   │   │   │   │   ├── onboarding/ (Passphrase, Recovery, Pairing, SafetyNumber, PartnerRecovery)
│   │   │   │   │   ├── home/ (HomeScreen, EmotionalWeatherCard, NotAboutYouBanner)
│   │   │   │   │   ├── chat/ (ChatScreen, NeedMenuBottomSheet)
│   │   │   │   │   ├── journal/ (JournalScreen)
│   │   │   │   │   ├── repair/ (RepairKitScreen)
│   │   │   │   │   ├── lists/ (SharedListsScreen, ChoreSplitScreen, MoneyLightScreen)
│   │   │   │   │   ├── memory/ (TimelineScreen, QuoteJarScreen)
│   │   │   │   │   └── settings/ (SettingsScreen, ConsentAuditLogScreen)
│   │   │   │   └── widget/ (PartnerMoodGlanceWidget)
│   │   │   └── res/ (strings, colors, themes, xml)
│   │   └── test/java/app/two/android/ (CryptoEngineTest, SafetyNumberTest, CrdtSyncTest)
├── gradle/
│   ├── libs.versions.toml (Version catalog)
│   └── wrapper/gradle-wrapper.properties
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
└── gradlew.bat
```

---

## How to Open in Android Studio

1. Open **Android Studio** (Ladybug / Koala or newer).
2. Select **File $\rightarrow$ Open** and navigate to:
   ```
   C:\Users\dines\.gemini\antigravity\scratch\two-android
   ```
3. Allow Gradle to sync dependencies from `gradle/libs.versions.toml`.
4. Run on an Android Emulator or physical device (Android 8.0+ / API 26+).
