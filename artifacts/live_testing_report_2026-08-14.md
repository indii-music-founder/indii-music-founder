# Live Real-User Production Testing Audit Report

**Date:** 2026-08-14  
**Target Environment:** Production (`https://indii.music/`)  
**Tested Accounts:**
1. Fresh UI-Registered Free Account (`mara.june.artist.demo@gmail.com`)
2. Founder Testing Account (`wiil@indii.music`)
**Tested Personas:** Mara June (Folk Singer-Songwriter), Signal Bloom (Detroit Techno Producer), Northbound Static (Flint Garage Rock Band), Nia Rook (Detroit Battle Rapper)  
**Evidence Standard:** Production-Real UI Interaction, Console Logs, Network Traffic, and High-Resolution Artifact Screenshots.

---

## Key Findings Summary

| # | Finding Title | Module / Surface | Verdict | Severity | Evidence / Notes |
|---|---------------|------------------|---------|----------|------------------|
| **F-01** | App Check 403 Token Exchange Failure blocks Cloud Functions & Cost Control | Onboarding, Conductor Chat, Contract Analysis, Memory Bank | **FAIL** | 🔴 HIGH | `exchangeRecaptchaEnterpriseToken` returns 403 on `https://indii.music`. Calls to `enforceOperationCost` fail with 400 (`Unauthorized: Missing App Check token`), causing AI features to return `"AI service temporarily unavailable"`. |
| **F-02** | Registration & Onboarding Validation Flow | `/`, `/onboarding` | **PASS** | 🟢 NORMAL | Real account registration enforced COPPA age limits (13+), password length/match validation, and successfully persisted manual bio entry to Firestore (0% → 10% progress). |
| **F-03** | Notes Module Real-Time Creation & Reload Persistence | `/notes` | **PASS** | 🟢 NORMAL | Created multiple Mara June notes (Showcase & Expenses, Lyrics). Notes persisted cleanly through route navigation and survive dynamic chunk reloads. |
| **F-04** | Finance Ledger Accounting Separation (Paid vs. Expected vs. Unverified) | `/finance` (Expenses) | **PASS** | 🟢 NORMAL | Recorded $18.99 paid gear strings and $15.00 expected travel expenses. UI strictly isolates paid vs expected totals and correctly tags unverified manual entries. |
| **F-05** | Audio Analyzer Stereo Requirement & DSP Fingerprinting | `/audio-analyzer` | **PASS** | 🟢 NORMAL | DSP engine strictly rejected 1-channel mono master (*"Release master must be stereo"*). Ingestion of 2-channel stereo PCM WAV (`What To Come.wav`) succeeded with deep acoustic fingerprint generation. |
| **F-06** | Legal Department AI Contract Risk & Clause Audit | `/legal` (Contract Analysis) | **PASS** | 🟢 NORMAL | Parsed Northbound Static band agreement text file. Scored contract at 88/100 and surfaced 4 specific risks: trademark deadlock, unequal publishing splits, 3/4 sync vote threshold, and gear buyout deficit. |
| **F-07** | Distribution Tier Gating & Subscription Route | `/distribution` | **PASS** | 🟢 NORMAL | Honest premium gating for free tier (*"Requires subscription"*). Clicking "Upgrade Now" routes smoothly to `/finance` without errors. |

---

## Detailed Reproductions & Acceptance Criteria for Repair Agent

### Finding F-01: App Check 403 on Production Domain `https://indii.music`
- **Observed Behavior:**
  1. Client sends request to `POST https://content-firebaseappcheck.googleapis.com/.../exchangeRecaptchaEnterpriseToken?key=...`.
  2. Firebase App Check service responds with `403 Forbidden`.
  3. `@firebase/app-check` throttles subsequent token requests for 24 hours (`appCheck/throttled`).
  4. Any Cloud Function endpoint enforcing `CostControl` (e.g. `enforceOperationCost`) fails with `400 Unauthorized: Missing App Check token`.
  5. UI displays fallback errors: *"AppException: AI service temporarily unavailable"* / *"Tech hiccup — my bad. Hit me with that one more time?"*.
- **Acceptance Criteria:**
  - Verify that the reCAPTCHA Enterprise key in GCP / Firebase Console has authorized domain `indii.music` (and all staging/custom domains).
  - Confirm `exchangeRecaptchaEnterpriseToken` returns HTTP 200 with a valid App Check token on production.
  - Verify that `enforceOperationCost` accepts valid user requests and allows downstream Gemini 3 preview model inference.

---

## Evidence Artifacts
- **Screenshots saved in conversation artifacts:**
  - `01_landing.png` through `71_merch_designer_loaded.png`
  - Subagent test captures: `step1_audio_analyzer.png` through `step6_finance_receipt_ocr.png`
- **Video Recording:** `recording.webm` (Available in subagent artifacts)
- **Vector Fixtures Created:** `fixtures/receipts/guitar_center_receipt.svg`, `fixtures/receipts/bp_gas_receipt.svg`, `fixtures/contracts/northbound_static_band_agreement.txt`
