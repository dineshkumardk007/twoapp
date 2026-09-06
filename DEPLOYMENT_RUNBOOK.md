# Two — Production Deployment & Operations Runbook

How to put the **Two** relay and web client on the internet so two people, on two
phones, in two different places, share one private space.

---

## 1. System Architecture

```
              Partner A                         Partner B
           (phone browser)                   (phone browser)
                  │                                 │
                  │   both derive the SAME spaceId  │
                  │   and AES-256 key from the      │
                  │   shared 8-word pairing code    │
                  └────────────────┬────────────────┘
                                   │ HTTPS / WSS (443)
                                   ▼
                        [ Caddy Reverse Proxy ]
                     Automatic Let's Encrypt TLS
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
          [ two-web container ]          [ two-server container ]
             Nginx, port 80                 Node 22, port 4000
                                                   │
                                                   ▼
                                          [ PostgreSQL 16 ]
                                        stores ciphertext only
```

### How the two devices find each other

There are no accounts and no login. The entire connection is bootstrapped from
one shared secret — an **8-word pairing code**:

1. Partner A opens the app and chooses **Create our space**. The app generates
   eight random words.
2. A reads the words to B in person or over a phone call. **Not over the
   internet** — anyone holding the words can read the space.
3. Partner B chooses **Join my partner's space** and types the words in.
4. Both devices independently run PBKDF2-SHA256 (210,000 iterations) over the
   code to derive:
   * `spaceId` — the relay room name, salted `two.space.id.v1`
   * `spaceKey` — an AES-256-GCM key, salted `two.space.key.v1`
5. Both compare the **safety number** (emoji + words) on screen. It is derived
   from the code, so it only matches when both really hold the same secret.

Because the two derivations use different salts, the `spaceId` the server learns
reveals nothing usable about the key protecting the content.

### What the server can and cannot see

Every record is encrypted in the browser before it is sent. The relay stores and
forwards opaque base64 blobs, and holds no key material.

| Server sees | Server cannot see |
|---|---|
| `spaceId` (a hash) | The pairing code |
| `authorId` (`user` / `partner`) | Any message, mood, list, letter or drawing |
| Record type (e.g. `CHAT`) | Anything inside the payload |
| Ciphertext + nonce, timestamps | |

If a message arrives that fails AES-GCM authentication, the client drops it.

### Offline delivery

Phones suspend their browsers constantly, so records are persisted, not just
forwarded. Each client remembers the highest Lamport clock it has applied and
sends it on `JOIN`; the relay replays only what that device actually missed
(capped at 500 records per join). A message sent while your partner's screen is
off arrives the next time they open the app.

---

## 2. Server Requirements

* **Environment:** any Linux VPS — Hetzner, DigitalOcean, Lightsail, GCP.
* **Specs:** 1 vCPU, 1–2 GB RAM, 20 GB SSD. Ubuntu 22.04 or 24.04 LTS.
* **A domain name pointing at the server's IP.** This is not optional: Caddy
  needs it to issue a TLS certificate, and browsers refuse `ws://` from an
  `https://` page.

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git ufw
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

Point an **A record** for your domain at the server's public IP before
continuing, and confirm it resolves:

```bash
dig +short your-domain.com
```

---

## 3. Deployment

### Step A: Clone and configure

```bash
git clone https://github.com/dineshkumardk007/twoapp.git
cd twoapp
```

Create `.env` in the project root:

```env
DOMAIN=your-domain.com
POSTGRES_PASSWORD=<a long random password>
```

Generate the password rather than inventing one:

```bash
openssl rand -base64 32
```

`docker-compose.prod.yml` reads both values, and derives `DATABASE_URL` and
`CORS_ORIGIN` from them automatically.

### Step B: Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy requests a Let's Encrypt certificate on first boot, which takes a few
seconds. There is **no migration step** — the relay creates its tables on
startup if they do not exist, so this command is safe to re-run.

### Step C: Verify

```bash
curl -s https://your-domain.com/health
```

Expect `"status":"ok"` and — importantly — `"storage":"postgres"`:

```json
{"status":"ok","app":"Two Zero-Knowledge Relay","storage":"postgres","zero_knowledge":true}
```

If it says `"storage":"memory"`, `DATABASE_URL` did not reach the container and
**every message will be lost on restart**. Check `.env` and re-run Step B.

Confirm the WebSocket upgrade succeeds:

```bash
curl -sI -o /dev/null -w '%{http_code}\n' https://your-domain.com/relay
```

### Step D: Pair the two phones

1. Both partners open `https://your-domain.com` and add it to their home screen
   (iOS: Share → Add to Home Screen; Android: menu → Install app).
2. One creates the space; the other joins with the eight words.
3. Verify the safety numbers match.

---

## 4. Operations

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f two_server
```

### Backups

The database holds ciphertext, so a dump is safe to store — but it is also
useless without the couple's pairing code. Losing the code loses the data.

```bash
# Nightly snapshot at 03:00 UTC
0 3 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T two_db \
  pg_dump -U two_admin two_space_db | gzip > /backups/two_$(date +\%F).sql.gz
```

### Rotating a pairing code

There is no server-side revocation, because the server has no authority over a
space. To cut off a leaked code, both partners re-pair with a fresh code; the
old room's ciphertext remains but is no longer read or written by either device.

---

## 5. Android Client — Current Status

**The Android app does not connect to this server yet.** Read this before
distributing the APK.

The relay plumbing in `two-android` is scaffolding, not a working client:

* `RelayApiClient`, `AndroidWebSocketRelay` and `NetworkConfig` have **no call
  sites** anywhere in the app.
* `AndroidWebSocketRelay.connect()` sets a boolean; `broadcastEncryptedRecord()`
  builds a JSON object and discards it. The comment says *"In production,
  instantiate OkHttp WebSocket connection."*
* `SyncWorker.doWork()` drains the outbound queue **without transmitting it**.
* `NetworkConfig` is hardcoded to `10.0.2.2` (emulator) and a LAN IP, over
  plaintext `http://` / `ws://`.
* No HTTP client (OkHttp/Ktor) is on the dependency list.

The APK is therefore a fully local, single-device app: installing it on two
phones gives two apps that never see each other.

To make it work, the outstanding tasks are:

1. Add OkHttp and implement `AndroidWebSocketRelay` against `wss://`.
2. Port the pairing-code derivation (PBKDF2 → `spaceId` + AES key) from
   `two-web/src/core/space.ts` so both platforms derive identical values.
3. Make `SyncWorker` actually POST to `/sync/push` and honour the ACK.
4. Replace `NetworkConfig` constants with a configurable server URL.
5. Keep `https`/`wss` — `targetSdk 35` blocks cleartext by default.

Until then, the PWA is the supported way for two people to share a space.

### Signing a release APK (for when it is ready)

```bash
keytool -genkey -v -keystore two-release.keystore \
  -alias two-production-key -keyalg RSA -keysize 2048 -validity 10000
```

Put `two-release.keystore` in `two-android/app/` and add to `local.properties`:

```properties
RELEASE_KEYSTORE_PASSWORD=...
RELEASE_KEY_ALIAS=two-production-key
RELEASE_KEY_PASSWORD=...
```

> Note: `app/build.gradle.kts` currently signs release builds with the **debug**
> keystore (`signingConfig = signingConfigs.getByName("debug")`). Point it at a
> real release config before publishing anywhere.

```bash
cd two-android
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # app/build/outputs/bundle/release/app-release.aab
```

---

## 6. Verification Checklist

- [x] Relay forwards encrypted records between two clients in the same space.
- [x] Clients with different pairing codes are fully isolated.
- [x] Stored records contain no plaintext and no pairing words.
- [x] Records sent while a partner was offline replay on reconnect.
- [x] Schema creates itself on boot and is safe to re-run.
- [ ] TLS certificate issued for your domain (verify after Step C).
- [ ] Android client wired to the relay (see section 5).
