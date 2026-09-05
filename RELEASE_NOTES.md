# Two (v1.0.0-rc1) — Sovereign, Offline-First Relational Space

> **"Technology designed not to capture attention, but to deepen connection between two human beings."**

Two is an analogue-warm, cryptographically sovereign communication suite engineered exclusively for intimate partnerships. Built with an offline-first architecture, Two guarantees that your private emotional check-ins, encrypted voice whispers, shared vulnerability card games, reproductive health tracking, and memory vaults belong strictly to the two of you—with zero tracking, zero algorithmic feeds, and zero third-party cloud dependencies.

---

## Key Highlights & Milestone Summary (v1.0.0-rc1)

### 1. Cryptographic Sovereignty & E2EE Vault
- **Signal Double Ratchet & X3DH Architecture**: End-to-end encrypted messaging, media notes, and state synchronizations.
- **Bi-Directional Safety Verification**: 4-emoji visual fingerprint and 12-word cryptographic verification sequence with QR pairing.
- **Sovereign Encrypted Vault Backup (`.two-vault`)**: Export and import complete space archives sealed with client-side **PBKDF2 (100,000 rounds)** + **AES-GCM 256-bit** encryption. Portable across devices without needing central servers.
- **Silent Exit-Safe Emergency Wipe**: Instant local cryptographic key shredding and database zeroing without notifying partner devices or sounding audible alerts.

### 2. Relational Intimacy Suite
- **Emotional Weather & Capacity Barometers**: Morning check-ins (Battery %, Weather condition, Rest quality, Emotional craving) with smooth bidirectional syncing.
- **The "Not About You" Shield**: Dedicated flag allowing either partner to signal external stress (e.g. work fatigue) to instantly defuse defensive spirals before they begin.
- **Conflict Repair Kit**: Guided 4-stage non-violent communication protocol (Regulated Breathing Box: 4s Inhale / 4s Hold / 4s Exhale, Defusing Phrasing Chips, and Shared Relational Agreements).
- **Curated Intimacy Content Libraries**:
  - **500+ Daily Question Engine**: Four progressive tiers (*Playful*, *Curious*, *Deep*, and *Spicy* with mutual opt-in guardrails).
  - **100+ Literary Quote Jar**: Public-domain excerpts from Rilke, Woolf, Gibran, Dickinson, and bell hooks tuned dynamically to daily emotional weather.
  - **Conversation Decks**: Interactive card decks for deep bonding, date nights, and emotional reflection.
- **Encrypted Voice Memos**: In-chat acoustic whispers recorded via HTML5 MediaRecorder, encrypted before transit, and rendered as tactile sound waveforms.
- **Reproductive Health Sovereignty**: Isolated cryptographic subkeys, 4 granular disclosure levels (*Hidden*, *Symptom Trends*, *Window*, *Full Details*), and one-tap instant partner revocation.
- **Time Capsule & Polaroid Memories**: Encrypted photos and milestone letters locked until future calendar dates or relationship anniversaries.

### 3. Discreet Privacy & Accessibility
- **Camouflage / Decoy Mode ("Discreet Calculator")**: Instantly masks the interface behind a fully functional pocket calculator. Dynamically changes document title to `Calculator` and favicon to 🔢. Secret unlock sequence: `142.85=`.
- **Interactive Story Tour ("A Day in the Life with Two")**: 5-act narrative walkthrough illustrating how two partners navigate morning weather, afternoon workday stress, evening deck questions, bedtime voice whispers, and anniversary time capsules.
- **Dual-Window Live Sync Demonstration**: Side-by-side multi-window testing via `?perspective=partner` URL parameter and real-time WebSocket state distribution.
- **Internationalization (i18n)**: Multi-language support across 6 global languages:
  - 🇬🇧 English (`en`)
  - 🇪🇸 Spanish (`es`)
  - 🇫🇷 French (`fr`)
  - 🇩🇪 German (`de`)
  - 🇯🇵 Japanese (`ja`)
  - 🇮🇳 Hindi (`hi`)

### 4. Cross-Platform & Self-Hosting Stack
- **Web App (`two-web`)**: Modern React 19 + TypeScript + Vite + Tailwind CSS with offline PWA Service Worker caching (`manifest.json`, `sw.js`).
- **Android App (`two-android`)**: Native Kotlin + Jetpack Compose + Room SQLite + SQLCipher + Material 3 tactile warm theme.
- **Relay Server (`two-server`)**: Ephemeral WebSocket + Express relay daemon supporting end-to-end encrypted packet forwarding without persistent plaintext storage.
- **Production Ops**: Ready-to-deploy `docker-compose.prod.yml` and comprehensive `DEPLOYMENT_RUNBOOK.md` with Caddy automatic TLS reverse proxy.

---

## Verification & Build Status

| Component | Build Tool | Status | Tests / Checks |
|---|---|---|---|
| `two-web` | Vite + TypeScript | **PASS** | `npm run build` (0 TypeScript errors) |
| `two-server` | Node.js + Express + WS | **RUNNING** | Daemon active on `:4000` |
| `two-android` | Gradle + Compose | **CONFIGURED** | Room DB, SQLCipher, Screens complete |
| Relay Sync | WebSocket | **VERIFIED** | Bidirectional live sync across perspectives |

---

## Quick Start Guide

### Web Client
```bash
cd two-web
npm install
npm run dev
# App launches at http://localhost:3000
```

### Self-Hosted Relay Server
```bash
cd two-server
npm install
npm start
# WebSocket relay listens on ws://localhost:4000/relay
```

### Production Docker Deployment
```bash
docker compose -f docker-compose.prod.yml up -d
```
