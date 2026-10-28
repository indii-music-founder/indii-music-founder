# Architectural Decision Record: DDEX ERN 4.3.2 & AI Metadata Compatibility Assessment

- **Issue Reference:** `P-DDEX-20261022-01`
- **Parent Objective:** `CI-V3-20261021-04` (DSP Human-Authorship & Opt-in Licensing Controls)
- **Status:** APPROVED & IMPLEMENTED
- **Date:** October 28, 2026
- **Authors:** Core Rights & Distribution Architecture Team

---

## 1. Context & Background

On October 22, 2026, a policy verification requirement was raised regarding the compatibility of the `indii.music` distribution pipeline with **DDEX ERN 4.3.2** (Electronic Release Notification version 4.3.2) and the emerging generative AI metadata tagging mandates enforced by major Digital Service Providers (DSPs) including Spotify, Apple Music, and YouTube Music.

Prior to this review, the system generated ERN feeds compliant with baseline ERN 4.3 schemas using preliminary internal tags (`isFullyAIGenerated`, `isPartiallyAIGenerated`). However:
1. Major DSPs standardized ingestion on **DDEX ERN 4.3.2** and the **DDEX Allowed Value Set (AVS Version 012)**.
2. DSP ingestion profiles expect standard `<ContainsAI>` enumerations (`None`, `Partly`, `All`) and granular `<AiContribution>` roles at the sound recording and contributor levels.
3. Distributors and automated classifiers risk misflagging human-created electronic, synthesizer, and sample-based compositions as "AI-generated," penalizing independent creators.
4. Distribution delivery manifests must never be misinterpreted as granting AI model training rights to DSPs or third-party crawlers.

---

## 2. Normative Sources & Primary Standards

1. **DDEX Knowledge Base & Standards Registry:**
   - *DDEX Standards Specifications:* [https://kb.ddex.net/reference-material/standards-specifications/](https://kb.ddex.net/reference-material/standards-specifications/)
   - *Allowed Value Set (AVS) Version 012:* Published 2026-09-16.
2. **Metadata Style Guidelines (DDEX ERN 4.3.2 Implementation):**
   - Standardization of `ContainsAI` values: `None`, `Partly`, `All`.
   - Contributor attribution via `<AiContribution>`.
3. **DSP Ingestion Mandates:**
   - *Spotify Human Artistry Announcement (October 20, 2026):* Requiring transparent provenance, clear differentiation of fully synthetic versus human-assisted audio, and protection of DAW/human-arranged electronic music.
   - *Apple Music Delivery Specifications:* Requiring disclosure of generative AI vocal synthesis and synthetic stems.
   - *YouTube Content ID & DDEX Partner Feeds:* Standardized delivery rules requiring clean separation between consumer commercialization deals and AI model training permissions.

---

## 3. Decision: Upgrade to Support ERN 4.3.2 Natively

We decided **not** to conduct a destructive rewrite of the distribution architecture, but to **natively upgrade the schema contracts and XML serialization** to support ERN 4.3.2 while retaining backward compatibility with ERN 4.3 receivers:

1. **Schema Version Compatibility:**
   - Updated `IngestionNotificationMessage['messageSchemaVersionId']` to `'4.3' | '4.3.2'`.
   - Outbound XML builder outputs valid namespaces (`http://ddex.net/xml/ern/43`) and attributes `MessageSchemaVersionId="4.3.2"`.

2. **Standardized AI Disclosure Fields:**
   - Implemented `DDEXContainsAI` (`'None' | 'Partly' | 'All'`) across `Release`, `Resource` (`SoundRecording`), and `Contributor`.
   - Serialized standard DDEX elements:
     - `<ContainsAI>None|Partly|All</ContainsAI>`
     - `<ResourceContributor><AiContribution>None|Partly|All</AiContribution></ResourceContributor>`
     - Retained granular transparency block `<AIGenerationInfo>` for extended tooling and audit logs.

3. **Protection of Human Electronic & Sample-Based Music:**
   - Implemented `classifyMusicAIStatus()` in `packages/shared/src/distribution/ernCompatibility.ts`.
   - Pure electronic production, synthesizer programming, DAW composition (Ableton, FL Studio, Logic Pro), and licensed sample collages are **strictly classified as `ContainsAI: 'None'`**.
   - Generative AI flags are reserved exclusively for synthetic audio generation (e.g. text-to-audio prompting) or human-directed AI tools (e.g. vocal tuning, AI mastering assist, which map to `'Partly'`).

4. **Strict Isolation of Distribution vs. AI Training Rights:**
   - Implemented `verifyDistributionVsTrainingBoundary()`.
   - Proves that DDEX ERN commercial deals (`SubscriptionModel`, `PayAsYouGoModel`, `AdvertisementSupportedModel`) authorize consumer playback/streaming only.
   - Commercial models or contracts attempting to sneak AI model training or LLM ingestion into delivery manifests are flagged as fatal security violations.

---

## 4. Verification & Terminal Evidence

1. **Unit & Integration Test Suite:**
   - `packages/shared/src/distribution/ddexBuilder.test.ts` (9 tests passing).
   - `packages/shared/src/distribution/ddexErnCompatibility.test.ts` (4 tests passing).
   - Entire distribution test suite (6 files, 42 tests passing).
2. **DSP Receiver Profiles Evaluated:**
   - `Spotify`: Verified `ContainsAI` and contributor tagging.
   - `AppleMusic`: Verified track titles and parental guidance schemas.
   - `YouTubeMusic`: Verified ad-supported territory scoping.
   - `GeneralDDEX`: Verified mandatory ISRC, ICPN, and schema validation.
