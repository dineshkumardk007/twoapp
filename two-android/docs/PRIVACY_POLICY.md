# Privacy Policy & Zero-Knowledge Architecture Disclosure

*Effective Date: September 2026*  
*Applicable Platforms: Android, Web, and Relay Services*

---

## 1. Foundational Commitment: The Zero-Knowledge Guarantee

Two is engineered from the ground up to be a private, end-to-end encrypted relational sanctuary. Our fundamental architectural axiom is that **the server operator cannot read couple content by design**. 

We do not sell data. We do not display advertisements. We do not profile your behavior. We do not train artificial intelligence models on your intimate communications.

---

## 2. What We Protect Against vs. What We Cannot Protect Against

### What Is Cryptographically Protected:
* **Server Compromises & Database Dumps:** If our servers or database backups are compromised, the attacker obtains only unreadable ciphertext blobs, random record UUIDs, and blinded timestamps.
* **Malicious or Subpoenaed Operators:** We cannot be compelled by subpoenas, national security letters, or law enforcement warrants to disclose your chats, journals, photos, or agreements, because **we do not possess the cryptographic keys to decrypt them**.
* **Man-in-the-Middle Network Interception:** All communications are sealed under client-derived X25519 identity keys and XChaCha20-Poly1305 AEAD before leaving your physical device.

### What We Cannot Protect Against (User Responsibilities):
* **Compromised Endpoints:** If your physical phone is infected with OS-level malware, commercial spyware, or a keylogger, keys in active device memory can be exposed.
* **Shoulder Surfing / Physical Access:** If an unauthorized party physically unlocks your phone or coerces you to authenticate via biometric sensors, content visible on screen is accessible.
* **Loss of Recovery Materials:** If both partners lose their physical devices AND their 12-word recovery phrases simultaneously, your data is permanently lost. **We have no backdoors, reset links, or recovery keys.**

---

## 3. Data Collection & Metadata Minimization

The server only retains the minimum metadata necessary to relay encrypted packets:

| Data Type | Server Visibility | Retention Policy |
| :--- | :--- | :--- |
| **Account Auth ID** | Pseudonymous identifier | Retained while space is active. |
| **Identity Public Key** | Plaintext X25519 public key | Publicly visible to invited partners for pairing. |
| **Encrypted Records** | Opaque ciphertext + nonce | Retained until deleted by space members. |
| **Record Timestamps** | Coarse server timestamp | Stored with second-level precision. |
| **Payload Size** | Obfuscated via byte padding | Padded into 64KB and 512KB uniform buckets. |
| **Typing & Presence** | **Zero visibility** | No typing indicators or online presence tracking exist. |
| **Server Access Logs** | IP address (ephemeral) | Stripped after 48 hours; purged within 7 days. |

---

## 4. International Regulatory Compliance: GDPR & India's DPDP Act

Two fully satisfies and exceeds the requirements of the **EU General Data Protection Regulation (GDPR)** and India's **Digital Personal Data Protection Act (DPDP) 2023**:

1. **Right of Access & Data Portability (GDPR Art. 15 & 20):** You can download your complete, unencrypted space history at any moment via **Settings $\rightarrow$ Export All Space Data**. The resulting JSON and Markdown files are open, portable, and generated entirely on-device.
2. **Right to Erasure / Silent Dissolution (GDPR Art. 17):** Tapping **Emergency Quick Exit** instantly shreds all local encryption keys, wipes the local SQLite database, and silently removes your account from the relay without notifying your partner or leaving residual data.
3. **Children's Privacy:** Two is strictly restricted to individuals aged 18 and older. We do not knowingly process data of minors.

---

## 5. Third-Party Subprocessors & Trackers

Two includes **zero third-party behavioral analytics, advertising SDKs, or social trackers** (no Google Analytics, Facebook Pixel, Adjust, AppsFlyer, or Mixpanel). Firebase Cloud Messaging (FCM) is utilized strictly for silent, data-only wake-up notifications containing zero message text or metadata.
