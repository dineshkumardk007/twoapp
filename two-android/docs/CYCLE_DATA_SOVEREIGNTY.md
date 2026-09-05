# Menstrual Cycle & Reproductive Health Data Sovereignty

*Technical & Legal Architecture Memorandum*

---

## 1. The Legal & Human Context

Following legal shifts in multiple global jurisdictions regarding reproductive privacy, health data tracking has transitioned from a routine convenience to an area of significant legal vulnerability. Commercial cycle-tracking apps have routinely monetized, leaked, or complied with third-party subpoenas to turn over menstrual history.

**Two takes an absolute cryptographic stance: Menstrual cycle tracking within this application is legally un-subpoenaable because it is mathematically unreadable to the server operator.**

---

## 2. Cryptographic Isolation & Subkey Architecture

Cycle data does not share keys with general chat or journal entries:
1. **Dedicated Domain Subkey:** Derived on device via:
   $$\text{Subkey}_{\text{cycle}} = \text{crypto\_kdf\_derive\_from\_key}(\text{context} = \text{"cycleshr"}, \text{id} = 7, \text{key} = \text{SpaceKey})$$
2. **Selective Granular Disclosure:**
   * **Level 1 (General Phase Only):** Encrypts only broad phase names (e.g., *"Luteal Phase — Low Energy"*) for the partner. Raw symptom notes, flow metrics, and dates remain encrypted strictly under the owner's private subkey.
   * **Level 2 (Full Sharing):** Encrypts symptoms and phase logs for the partner under the cycle subkey.
   * **Level 3 (Completely Private):** Encrypted exclusively under the owner's private key (`privat_j`). The partner’s device is cryptographically incapable of decrypting the data.
3. **Instant Revocation:** The owner can revoke partner access to historical and future cycle data with a single tap. Revocation generates a fresh cycle subkey and re-encrypts historical entries under the owner's private key.

---

## 3. Subpoena & Third-Party Resistance

* **No Server Plaintext:** The server only stores opaque bytes in `records` (`type: 'event'`).
* **Zero Decryption Capability:** If presented with a court order or subpoena demanding cycle tracking logs for a user, **the server operator can produce only random-looking encrypted blobs and nonces**.
* **Zero Metadata Inference:** Cycle records are padded to uniform block boundaries (64KB buckets) to prevent payload length from revealing cycle regularity, pregnancy status, or missed phases.
