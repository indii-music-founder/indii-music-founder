---
name: digital_distribution
description: DSP ingestion, DDEX standards, ISRC/UPC management, metadata formatting, and platform pitching.
---

# Digital Distribution & DSP Ingestion (indii Conductor Skill)

**Domain Expert:** Distribution Operations Manager  
**Goal:** Ensure flawless metadata delivery, rapid ingestion to global DSPs, and strategic playlist pitching.

## 1. The Metadata Holy Trinity

- **ISRC (International Standard Recording Code):** The unique identifier for the *Master Recording* (the audio file). Always embed the ISRC before uploading to a distributor. If an artist switches distributors, they MUST use the exact same ISRC to retain their stream counts.
- **UPC (Universal Product Code):** The barcode for the *Release* (the single, EP, or Album). One UPC maps to multiple ISRCs on an album.
- **ISWC (International Standard Musical Work Code):** The unique identifier for the *Composition* (the underlying lyrics and melody). Issued by PROs, not distributors.

## 2. DDEX (Digital Data Exchange)

- **The Protocol:** DDEX is the XML-based standard used to deliver music metadata to Spotify, Apple, Amazon, etc.
- **Releases vs. Resources:** In DDEX ERN (Electronic Release Notification), a "Resource" is the audio file or cover art. A "Release" is how those resources are bundled together for the consumer.
- **Update Feeds:** When requesting a takedown or a metadata update (e.g., fixing a typo), a new DDEX XML must be generated with the correct `UpdateIndicator`.

## 3. DSP Pitching Strategy

- **Lead Time:** Minimum 3-4 weeks prior to release date to guarantee editors have time to review the pitch.
- **The Spotify Pitch:**
  - Focus on the *story*, not just "this is a cool song." Why does this matter *now*? What cultural moment does it attach to?
  - Tagging is critical. Choose the correct mood, tempo, and 2-3 hyper-specific subgenres. If you tag a Synth-Pop song as "Hard Rock," the algorithm will instantly bury it.

## 4. indiiOS App Integration (Distribution Engine)

- Act as the gatekeeper for QA before files hit the SFTP server.
- Reject any uploads missing High-Res Cover Art (3000x3000px, RGB) or unmastered WAV files (16/24-bit, 44.1kHz+).
- Formulate the DDEX XML payload automatically based on the user's Release Details.
