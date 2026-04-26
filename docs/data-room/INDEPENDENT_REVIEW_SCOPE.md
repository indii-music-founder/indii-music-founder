# Independent Code Review Scope

**Purpose:** Define the boundaries and focus areas for a third-party technical review of indiiOS.

**Valuation Thesis Being Tested:** indiiOS is worth $X because it owns (1) a DDEX direct-distribution rail, (2) a 17-agent Vertex AI fine-tuned fleet, and (3) 99.6% test pass rate across 268K LOC.

---

## Scope: In

The reviewer should focus on these three subsystems, which are the basis of valuation:

### 1. DDEX Distribution Layer (Priority: CRITICAL)

**Why:** Direct-to-DSP music distribution is the primary business asset. Acquirer needs to verify this is real, spec-compliant, and operationally sound.

**Files to Review:**
- `src/services/ddex/` — ERN/DSR/MEAD/RIN generation and validation
- `execution/distribution/` — Python DDEX generation scripts, SFTP delivery, QC logic
- `src/services/distribution/adapters/` — 8 distributor adapters (CDBaby, Spotify, Apple, Amazon, Tidal, Deezer, legacy aggregators)
- `src/core/config/ddex.ts` — Party ID, DSP credentials configuration

**Verification Checklist:**
- [ ] ERN XML structure matches published DDEX XSD (at least one sample generation)
- [ ] SFTP delivery mechanism is hardened (no creds in logs, proper error handling)
- [ ] DSP onboarding adapters are real, not mocks (confirm each has actual API integration, not stubs)
- [ ] DDEX Party ID `PA-DPIDA-2025122604-E` is registered to New Detroit Music LLC
- [ ] Delivery receipt/acknowledgment handling is idempotent (no duplicate submissions on retry)
- [ ] No hardcoded DSP API keys in `src/` (should be Firestore/Cloud Secrets)

**Effort:** 2–3 days on-site or remote with codebase access

---

### 2. Agent Fleet & Fine-Tuning Pipeline (Priority: CRITICAL)

**Why:** The 17-agent Vertex AI fleet is the operational engine. Acquirer needs to verify endpoints are live, models are fine-tuned, and fallback logic is robust.

**Files to Review:**
- `src/services/agent/fine-tuned-models.ts` — Registry of 16 R5 endpoints + 1 undefined (`keeper`)
- `src/services/agent/BaseAgent.ts` — Base agent class, tool enforcement, prompt injection protection
- `src/services/agent/AgentService.ts` — Agent routing and orchestration
- `src/services/agent/FallbackClient.ts` — Fallback to free Gemini API when Vertex fails
- `src/services/agent/AgentPromptBuilder.ts` — Prompt injection sanitization (4 layers: NFKC → Unicode tag strip → zero-width strip → 17 patterns)
- `execution/training/` — Fine-tuning dataset generation and export scripts

**Verification Checklist:**
- [ ] All 16 R5 endpoints are deployed and reachable (test a live call to at least 3 agents)
- [ ] Endpoints return domain-appropriate output (e.g., legal agent returns contract analysis, not song lyrics)
- [ ] Fallback logic works: when Vertex is down, requests route to free Gemini API without breaking user experience
- [ ] Prompt injection sanitization is real and effective (test with malicious payloads: Unicode tricks, zero-width chars, prompt-escape patterns)
- [ ] Fine-tuning dataset is >100 examples per agent and actually used in training (spot-check training config)
- [ ] Agent authorization (allowed tools per agent) is enforced server-side, not client-side

**Effort:** 3–4 days on-site or remote with GCP project access

---

### 3. Payment & Subscription (Priority: HIGH)

**Why:** Stripe integration and escrow logic are business-critical. Acquirer needs to verify financial flows are correct and idempotent.

**Files to Review:**
- `functions/src/stripe/connect.ts` — Stripe Connect account creation
- `functions/src/stripe/splitEscrow.ts` — Escrow splitting logic (royalty waterfall)
- `functions/src/stripe/taxForms.ts` — Tax form stub (already documented in KNOWN_GAPS)
- `functions/src/subscription/` — Subscription tier management and quota enforcement
- Firebase security rules (Firestore + Storage) — User isolation and payment data protection

**Verification Checklist:**
- [ ] Stripe webhook handling is idempotent (duplicate events don't double-charge)
- [ ] Escrow split logic is mathematically correct (spot-check: $100 split 50/50 = $50 to each, no rounding errors)
- [ ] Payment confirmation is transactional (user can't withdraw funds before charge settles)
- [ ] No client-side trust violations (no raw Stripe keys sent to frontend, all server-validated)
- [ ] Tax forms stub is documented and not called in production flow
- [ ] Firestore security rules prevent IDOR (user A cannot read/write user B's payment data)

**Effort:** 1–2 days on-site or remote with Stripe sandbox access

---

## Scope: Out

The reviewer should NOT spend time on:

- **UI Layer** (`src/modules/`, `src/components/`) — visual consistency, UX, responsive design
- **Marketing Site** (`landing-page/`) — copy, branding, SEO
- **Internal Tooling** (`scripts/`, `.github/workflows/`) — CI/CD, build optimization
- **Training Data** (fine-tuning datasets beyond verification of >100 examples per agent)
- **Mobile/Electron Packaging** (`electron/`) — desktop app distribution, signing, auto-update
- **Documentation** (`docs/`) — unless it conflicts with code

---

## Verification Gates (12 Items)

The reviewer must explicitly verify and sign off on these 12 gates:

### Vertex AI (Gates 1–4)

1. **Endpoint Reachability** — Call all 16 R5 endpoints with a test prompt; confirm each returns within SLA (< 5s P99) and produces domain-appropriate output
2. **Fine-Tuning Verification** — Inspect training dataset (>100 examples per agent), verify models were trained on Vertex AI (check job history), confirm endpoints are fine-tuned not base
3. **Fallback Logic** — Simulate Vertex outage; confirm requests automatically route to free Gemini API without user-facing errors
4. **Prompt Injection** — Submit test payloads (Unicode escapes, zero-width chars, "ignore above" prompts); confirm all are neutralized before reaching model

### DDEX (Gates 5–7)

5. **ERN Spec Compliance** — Generate one ERN per configured DSP, validate against published XSD, confirm structure matches DDEX standard (not a custom format)
6. **SFTP Delivery** — Deliver a test ERN to a test SFTP target; confirm file arrives intact, no creds in logs, retry logic works
7. **Party ID Verification** — Contact DDEX Inc. or verify via DDEX portal that Party ID `PA-DPIDA-2025122604-E` is registered to New Detroit Music LLC and active

### Payments (Gates 8–10)

8. **Stripe Idempotency** — Fire duplicate webhook events (via Stripe CLI) to the same charge; confirm Firestore state is updated only once (no double-debit)
9. **Escrow Math** — Spot-check: $100 split 50/50 to artist A and artist B, confirm each receives $50 (no rounding loss, no fees deducted twice)
10. **Security Rules** — Attempt IDOR attack: authenticated user A tries to read/write user B's payment records via Firestore API; confirm access denied

### Infrastructure (Gates 11–12)

11. **App Check & Auth** — Confirm production Firebase functions enforce App Check tokens; test that unauthenticated or invalid App Check requests are rejected
12. **Backup & DR** — Confirm Firestore has automated daily exports, GCS backup bucket has retention policy, GCP project has billing alerts to prevent runaway costs

---

## Deliverable: Signed Report

The reviewer produces a PDF report with:

**Format:**
- Executive summary (1 page): pass/fail on the valuation thesis
- Findings by severity: Critical / Major / Minor / Informational
- Per-gate verdict: Pass / Fail / Conditional (with explanation)
- Recommended remediation (if any) with effort estimates
- Sign-off and date

**Audience:** New Detroit Music LLC (dba indiiOS) and any prospective acquirer

**Timing:** 2–3 weeks from engagement date (depending on access latency and parallel execution)

---

**Last Updated:** 2026-04-27
**Prepared By:** William Roberts (valuation phase)  
**For:** Independent technical reviewer
