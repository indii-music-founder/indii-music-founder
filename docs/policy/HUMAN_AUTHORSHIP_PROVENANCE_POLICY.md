# Human-Authorship Provenance, AI Licensing, and Anti-Synthetic Distribution Policy

- **Reference:** `CI-V3-20261019-06`
- **Parent & Related Nodes:** `CI-V3-20261021-01`, `CI-V3-20261021-04`, `P-DDEX-20261022-01`, `GitHub #412`
- **Domain:** Human-Artistry Provenance, Distribution Ingestion, and Investor Positioning
- **Date:** October 28, 2026
- **Status:** APPROVED BINDING POLICY

---

## 1. Executive Mandate & Core Tenets

`indii.music` is committed to protecting, advancing, and monetizing genuine human musical artistry. In response to competitive distributor shifts (e.g., Spotify's Human Artistry Initiative, Believe's licensed remix agreements) and widespread AI ingestion abuses across digital platforms:

1. **Zero AI-Generated Music Distribution:**
   `indii.music` **strictly prohibits the distribution of fully AI-generated music** (e.g. tracks synthesized via text-to-audio prompting tools like Suno or Udio). Such content will be blocked at preflight ingestion and rejected from DDEX/CWR feeds.
2. **Protection of Human Electronic & Sample-Based Creators:**
   Legitimate human musical creation utilizing Digital Audio Workstations (DAWs), hardware/software synthesizers, drum machines, MIDI sequencing, and cleared/licensed samples is **100% human-authored music**. Automated classifiers must never classify human electronic arrangements or sample collages as AI-generated (`ContainsAI: 'None'`).
3. **Strict Separation of Distribution Rights from AI Training:**
   Uploading or distributing music through `indii.music` grants DSPs a license for consumer playback and downloads **only**. It does **not** grant rights to ingest or train generative AI or machine-learning models. Any AI training requires an affirmative, multi-party, paid license.
4. **Transparent AI Assistance Disclosures:**
   When human artists use AI-assisted processing tools (e.g. vocal tuning, automated stem cleanup, AI mastering assist), transparency disclosures must be preserved without stripping artist credits or mislabeling the primary composition.

---

## 2. Technical Implementations & Test Enforcements

The policy is enforced programmatically across the repository:

### 2.1 Distribution Ingestion & Provenance Controls
* **Module:** [`packages/shared/src/rights/dspProvenancePolicy.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/dspProvenancePolicy.ts)
* **Tests:** [`packages/shared/src/rights/dspProvenancePolicy.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/dspProvenancePolicy.test.ts) (7 tests passing)
* **Mechanisms:**
  - Evaluates track inputs across human authorship, AI disclosures, licensed cover/remix consent, and training permissions.
  - Rejects tracks where `authorshipClassification === 'fully_ai_generated'` (`BLOCKED_FULL_AI_GENERATION`).
  - Verifies that human electronic tracks with DAW arrangements or cleared samples receive `clearedForDistribution: true` and `aiRecommendationRisk: 'clean'`.
  - Accurately tracks platform moderation stats: distinguishes 50M tracks removed from recommendation algorithms from 75M removed completely from platforms.

### 2.2 DDEX ERN 4.3.2 Standardization & Isolation
* **Module:** [`packages/shared/src/distribution/ernCompatibility.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/distribution/ernCompatibility.ts)
* **Tests:** [`packages/shared/src/distribution/ddexBuilder.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/distribution/ddexBuilder.test.ts) (9 tests passing)
* **Mechanisms:**
  - `classifyMusicAIStatus()` maps electronic/sample tracks to `<ContainsAI>None</ContainsAI>`.
  - `verifyDistributionVsTrainingBoundary()` validates that outbound ERN deal terms contain zero AI model training or ingestion exploitation clauses.

### 2.3 Affirmative AI Training Consent Gate
* **Module:** [`packages/shared/src/rights/aiTrainingConsent.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/aiTrainingConsent.ts)
* **Tests:** [`packages/shared/src/rights/aiTrainingConsent.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/aiTrainingConsent.test.ts) (10 tests passing)
* **Mechanisms:**
  - Deny-by-default on all master recordings, stems, lyrics, and metadata.
  - Requires explicit opt-in, non-revoked consent, and settled agreed compensation to both participating artists and `indii.music`.

---

## 3. Investor & Market Positioning

* **Integrity Guarantee:** `indii.music` provides enterprise partners, DSPs, and publishing societies with cryptographically verifiable provenance chains, ensuring catalog trust.
* **Artist Sovereign Control:** Independent artists retain 100% of their training rights. Their music is protected from unauthorized harvesting and algorithmic cloning.
