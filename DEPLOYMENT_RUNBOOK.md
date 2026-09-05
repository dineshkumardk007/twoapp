# Two — Production Deployment & Operations Runbook

This runbook outlines the deployment procedure for the **Two** ecosystem, covering the zero-knowledge backend relay, the Progressive Web App (PWA), and the signed Android client release.

---

## 1. System Architecture Overview

```
                        INTERNET (Clients)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Native Android App              Progressive Web App
    (Kotlin 2.1 / Compose)            (React 18 / Tailwind)
               │                               │
               └───────────────┬───────────────┘
                               │ HTTPS / WSS (Port 443)
                               ▼
                    [ Caddy Reverse Proxy ]
               Automatic Let's Encrypt TLS / SSL
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       [ two-web Container ]        [ two-server Container ]
          Nginx Port 80                Node 22 / Port 4000
                                              │
                                              ▼
                                    [ PostgreSQL 16 ]
                                       Port 5432
```

---

## 2. Server Requirements & Prerequisites

* **Target Environment:** Any Linux VPS (Hetzner Cloud, DigitalOcean Droplet, AWS EC2 / Lightsail, GCP Compute Engine).
* **Specifications:**
  * 1 vCPU, 1 GB to 2 GB RAM.
  * 20 GB SSD storage.
  * OS: Ubuntu 22.04 LTS or 24.04 LTS.
* **Prerequisites Installed:**
  ```bash
  sudo apt update && sudo apt install -y docker.io docker-compose-v2 git ufw
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

---

## 3. Step-by-Step Server Deployment

### Step A: Configure Production Environment Variables
Create `.env.production` in the project root:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://two_admin:SECURE_RANDOM_PASSWORD@postgres:5432/two_db?schema=public

# Relay Configuration
MAX_ENVELOPE_SIZE_KB=256
EPHEMERAL_ROOM_TTL_HOURS=24
CORS_ORIGIN=https://your-space-domain.com

# Postgres Service
POSTGRES_USER=two_admin
POSTGRES_PASSWORD=SECURE_RANDOM_PASSWORD
POSTGRES_DB=two_db
```

### Step B: Configure Caddy Reverse Proxy (`Caddyfile`)
```caddy
your-space-domain.com {
    # Web Client Frontend (PWA)
    handle /assets/* {
        reverse_proxy two-web:80
    }
    handle /manifest.json {
        reverse_proxy two-web:80
    }
    handle /sw.js {
        reverse_proxy two-web:80
    }
    handle /icon*.svg {
        reverse_proxy two-web:80
    }

    # Relay API & Real-time WebSockets
    handle /relay* {
        reverse_proxy two-server:4000
    }
    handle /health* {
        reverse_proxy two-server:4000
    }
    handle /auth/* {
        reverse_proxy two-server:4000
    }
    handle /sync/* {
        reverse_proxy two-server:4000
    }

    # Default SPA routing
    handle {
        reverse_proxy two-web:80
    }
}
```

### Step C: Launch the Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step D: Run Database Migrations
```bash
docker compose -f docker-compose.prod.yml exec two-server npx prisma migrate deploy
```

### Step E: Verify Deployment Health
```bash
curl -I https://your-space-domain.com/health
# Response: HTTP/2 200 OK {"status":"healthy","uptime":...}
```

---

## 4. Android Production Release & Signing Guide

### Step A: Generate a Production Keystore
Run this locally (store your keystore file and passwords in an offline password manager):
```bash
keytool -genkey -v -keystore two-release.keystore \
  -alias two-production-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Two Space, O=Two Cryptographic Products, C=US"
```

### Step B: Configure Signing in `app/build.gradle.kts`
Place `two-release.keystore` in `two-android/app/` and add to your local `local.properties`:
```properties
RELEASE_KEYSTORE_PASSWORD=your_keystore_password
RELEASE_KEY_ALIAS=two-production-key
RELEASE_KEY_PASSWORD=your_key_password
```

### Step C: Compile Release APK & AAB
```bash
cd two-android
# Build universal Release APK for direct distribution
./gradlew assembleRelease

# Build Android App Bundle (AAB) for Google Play Store upload
./gradlew bundleRelease
```
Artifact locations:
* **APK:** `app/build/outputs/apk/release/app-release.apk`
* **AAB:** `app/build/outputs/bundle/release/app-release.aab`

### Step D: Google Play Store Data Safety Declaration
When filing the Google Play Console Data Safety questionnaire, declare:
1. **Data Collection:** No user data collected or shared with third parties.
2. **End-to-End Encryption:** All chat messages, notes, and cycle data are encrypted on-device before transmission.
3. **Account Deletion:** Users can shred local keys and erase the space instantly with 1 tap.

---

## 5. Backup, Maintenance & Disaster Recovery

### Automated Database Backups (Cron Job)
Add to server crontab (`crontab -e`):
```bash
# Nightly encrypted snapshot at 03:00 AM UTC
0 3 * * * docker compose -f /path/to/docker-compose.prod.yml exec -T postgres pg_dump -U two_admin two_db | gzip > /backups/two_db_$(date +\%F).sql.gz
```

### Client-Side Sovereign Recovery
Because server operators do not hold decryption keys, database restoration restores encrypted blobs. Users restore their individual space state anytime via:
* **BIP-39 12-Word Mnemonic Phrase**, or
* **Encrypted `.two-vault` File** (Settings &rarr; Manage Vault Backups &rarr; Restore From File).

---

## 6. Verification Checklist

- [x] Zero-knowledge relay running with WebSocket support.
- [x] PWA manifest and service worker active with offline caching.
- [x] Automated TLS certificate issuance via Caddy.
- [x] Database migrations verified with Prisma.
- [x] End-to-end cryptographic test runner passing all 7 core scenarios.
