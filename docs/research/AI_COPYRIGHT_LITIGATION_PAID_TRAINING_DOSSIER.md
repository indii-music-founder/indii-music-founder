# AI Copyright Litigation & Paid-Training Consent Assessment Dossier

- **Reference:** `Child research: AI copyright litigation and paid-training consent`
- **Parent:** `CI-V3-20261021-01`
- **Related Nodes:** `CI-V3-20261019-06`, `GitHub #412`
- **Date:** October 28, 2026
- **Status:** COMPLETED LEGAL RESEARCH & POLICY AUDIT

---

## 1. Primary Litigation & Procedural Record

On **October 21, 2026**, oral arguments were held in the United States District Court for the Northern District of California before U.S. District Judge Eumi K. Lee in ***Concord Music Group, Inc., et al. v. Anthropic PBC*** (Case No. 3:23-cv-05444).

### 1.1 Core Claims & Arguments
* **Plaintiffs (Music Publishers):** Major publishers (Universal Music Publishing Group, Concord Music Group, ABKCO) moved for partial summary judgment, alleging that Anthropic scraped, copied, and ingested copyrighted song lyrics without a license to train its foundational Claude models. Plaintiffs presented telemetry demonstrating that the model reproduces lyrics verbatim or near-verbatim in response to user prompts (~120,000 prompt instances across a 6-month sample), diluting licensing markets and generating synthetic derivatives.
* **Defendant (Anthropic PBC):** Countered with fair use affirmative defenses under 17 U.S.C. § 107, arguing that model pre-training is intermediate and transformative, and contending that liability for prompt output belongs with end-users.
* **Procedural Posture:** **A hearing is not a final ruling.** Judge Lee rigorously interrogated both parties regarding fair use factor four (market harm) and intermediate copying precedents, taking the cross-motions under submission without issuing a summary judgment order from the bench.
* **Concurrent Filings (October 21, 2026):** Independent publisher Reservoir Media filed concurrent federal complaints against Anthropic and AI music generation developer Suno Inc., demanding statutory damages for unauthorized ingestion of over 1,000 musical works and protected lyric sheets.

---

## 2. Critical Legal Distinctions: Lyrics vs. Sound Recordings

Under U.S. Copyright law, musical works and sound recordings represent distinct bundles of exclusive rights:

1. **Composition & Lyrics (17 U.S.C. § 102(a)(2)):**
   - The *Concord v. Anthropic* action concerns text scraping and ingestion of literary/musical compositions (lyrics).
   - Ingestion into Large Language Models (LLMs) focuses on linguistic token extraction, rhyme structures, and text reproduction.
2. **Sound Recordings (17 U.S.C. § 102(a)(7)):**
   - The parallel federal actions (*UMG Recordings, Inc. v. Suno, Inc.* [D. Mass.] and *UMG Recordings, Inc. v. Uncharted Labs, Inc. (Udio)* [S.D.N.Y.]) assert infringement of the Section 106(1) reproduction right in master audio recordings.
   - Diffusion and spectrogram model ingestion involves direct acoustic audio decoding, timbre cloning, and vocal synthesis.
3. **Legal Non-Interchangeability:**
   - A favorable fair use determination regarding text/lyric LLM pre-training would **not** automatically insulate audio models ingesting commercial sound recordings.
   - Conversely, sound recording licenses do not confer rights to lyrics without publisher synchronization/mechanical clearance.

---

## 3. Policy & Architecture Audit for indii.music

### 3.1 Review of Existing Directives
We evaluated whether the October 21 hearings or related filings warrant any adjustment to `indii.music`'s existing policy:
* **Server-side Deny-by-Default:** Uploaded audio, stems, lyrics, MIDI, artwork, and metadata are inaccessible to third-party AI training scrapers or export pipelines.
* **Multi-Rightsholder Affirmative Opt-In:** All composition and master rightsholders must sign off explicitly before any training ingestion can occur.
* **Agreed Bipartite Compensation:** Training data export requires verified, settled financial compensation to both participating artists/writers and `indii.music`.

### 3.2 Formal Decision: No Weakening or Revision Required
The ongoing federal litigation validates `indii.music`'s strict architectural posture:
1. Platforms relying on implied consent or general terms of service are exposed to catastrophic statutory copyright liability ($150,000 per infringed work).
2. `indii.music`'s programmatic gate in [`packages/shared/src/rights/aiTrainingConsent.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/aiTrainingConsent.ts) (`AITrainingGrantSchema` and `evaluateAITrainingExport()`) protects artists, founders, and investors by enforcing explicit scope fences, vendor whitelists, and settled compensation prerequisites.
3. The platform maintains zero tolerance for unauthorized AI scraping while positioning verified, human-authored catalogs for institutional, legally cleared AI licensing deals on rightsholders' own terms.
