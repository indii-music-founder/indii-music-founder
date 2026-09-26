# TypeSafe Jev System One Knowledge Base & Judgment 72 Guide

This document is the authoritative repo guide and trigger checklist for knowing **when and how to implement Judgment 72** (and any future System One judgments) in indii.

---

## 1. Current State: Complete Coverage (Judgments 1–71)

As of September 2026, **71 typed judgments** are active across indii, backed by:
- **Central Registry:** All questions, options, criteria, and probability thresholds are consolidated in [`packages/renderer/src/config/typesafeJudgments.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/config/typesafeJudgments.ts).
- **Execution Gateway:** Securely proxied through the server-side `typesafeJudge` Firebase Cloud Function.
- **Fail-Safe Offline Contract:** Every judgment implements an instantaneous, 100% deterministic offline fallback.
- **Test Integrity:** Every judgment is unit-tested in [`packages/renderer/src/config/typesafeJudgments.test.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/packages/renderer/src/config/typesafeJudgments.test.ts).

---

## 2. Trigger Matrix: When is Judgment 72 Required?

Do **NOT** create a speculative judgment. Add Judgment 72 **only** when a new feature or real user workflow meets all 4 of these conditions:

| Condition | Description | Acceptable Example | Violation / Anti-Pattern |
| :--- | :--- | :--- | :--- |
| **1. Semantic Ambiguity** | Code is trying to parse or categorize human language, intent, tone, or subjective context where regexes/string checks become brittle. | Classifying messy festival contract rider clauses into strict operational requirements. | Parsing a known JSON payload or regex matching a standard ISRC/UPC check digit. |
| **2. Text/Metadata Input** | The input is unstructured text, transcribed speech, or upstream labels/tags. | Classifying transcribed backstage voice memos into urgent vs ambient notes. | Passing raw image pixel bytes or raw audio WAV buffers (Jev is text-only). |
| **3. High Frequency / Sub-Second** | A full Gemini thinking loop (Pro/Flash with multi-turn prompt) is too slow or too expensive for an ambient/inline micro-decision. | Real-time typing suggestions, instant inline badge categorization, stream spike triage. | Generating a full multi-page marketing plan or rewriting an album bio (use standard Gemini agent). |
| **4. Discrete Categorization** | The output cleanly maps to a **Choice** (enum/classification), **Noul** (calibrated yes/no probability), or **Score** (calibrated 0–5 rating). | Determining if a music video subtitle line needs censorship warning (`Noul`). | Generating open-ended creative essays or freeform code snippets. |

---

## 3. High-Value Candidate Triggers for Judgment 72

When one of these product surfaces is actively built, Judgment 72 should be invoked:

1. **Touring / Hospitality Rider Clause Classifier (`judgeContractRiderClause`)**
   - *Trigger:* Parsing festival performance agreements or venue technical/hospitality riders to auto-detect deal-breaker clauses (e.g. radius clause restrictions, merchandise fee cuts > 20%, technical power constraints).
   - *Model:* `Choice` (`RADIUS_RESTRICTION`, `MERCH_FEE_HAZARD`, `STAGE_POWER_CONSTRAINT`, `STANDARD_HOSPITALITY`).

2. **Backstage Voice Memo Intent Triage (`judgeBackstageMemoIntent`)**
   - *Trigger:* Artist speaks quick chaotic audio into Mobile Remote while off-stage; whisper transcript is passed for instant action routing.
   - *Model:* `Choice` (`EXPENSE_LOG`, `SONG_IDEA_MELODY`, `SETLIST_NOTE`, `COLLABORATOR_CONTACT`, `CREW_TASK`) + `Score` (urgency 1–5).

3. **Sync Licensing Cue Sheet Usage Type (`judgeSyncCueUsageType`)**
   - *Trigger:* Disambiguating cue sheet metadata entries (e.g. "Visual Vocal", "Background Instrumental", "Theme", "End Credits") for PRO broadcast reporting.
   - *Model:* `Choice` (`VISUAL_VOCAL`, `BACKGROUND_INSTRUMENTAL`, `FEATURED_THEME`, `PROMO_BUMPER`).

4. **Merchandise Sizing & Demand Sentiment (`judgeMerchDemandSentiment`)**
   - *Trigger:* Artist scans direct-to-fan comments asking for apparel or vinyl repress to predict restock risk.
   - *Model:* `Choice` (`HIGH_PURCHASE_INTENT`, `PRICE_SENSITIVE`, `CASUAL_COMPLIMENT`, `SPAM`) + `Noul` (`isDefiniteOrder`).

---

## 4. Step-by-Step Implementation Recipe for Judgment 72

When the need arises, follow this exact 5-step playbook:

### Step 1: Add to `packages/renderer/src/config/typesafeJudgments.ts`
1. Define the input interface and return type:
   ```typescript
   export interface Judgment72Input { ... }
   export interface Judgment72Verdict { ... }
   ```
2. Write the **offline deterministic heuristic** first (must execute in < 1ms without network).
3. Check `judgmentsAvailable()`: if false, immediately return the offline result.
4. Call `typesafeJudge` via `httpsCallable`:
   ```typescript
   const judgeFn = httpsCallable<...>(getFunctions(), 'typesafeJudge');
   const result = await judgeFn({
       state: { ... },
       questions: {
           verdict: {
               type: 'choice' as const, // or 'noul' or 'score'
               instructions: '...',
               criteria: { ... },
           },
       },
   });
   ```
5. Wrap in `try/catch` with `noteJudgmentFailure(err, 'judgment 72 description')` and fallback.
6. Export the function and any thresholds.

### Step 2: Add Comprehensive Unit Tests in `typesafeJudgments.test.ts`
Write tests covering:
- **Offline Fallback:** When `mocks.enabled.mockReturnValue(false)`.
- **Online Positive / Clean:** When `mocks.httpsCallable.mockReturnValue(...)`.
- **Online Flagged / Edge Case:** Ensuring correct parsing of Jev choices/probabilities.

### Step 3: Run the Verification Suite
Execute:
```bash
npx vitest run packages/renderer/src/config/typesafeJudgments.test.ts
npm run typecheck:renderer
node scripts/check-test-quality.js --diff
```

### Step 4: Wire into Consumer Service
Import and call the judgment from the consumer service with fail-soft error handling (`logger.debug` on error, never throw to the user).

### Step 5: Update Documentation
Increment this document and [`docs/TYPESAFE_OPPORTUNITIES.md`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/docs/TYPESAFE_OPPORTUNITIES.md) with the new judgment definition.
