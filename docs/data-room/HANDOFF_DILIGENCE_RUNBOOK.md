# Diligence + Founder Retention Runbook (Handoff)

**Generated:** 2026-04-26
**Audience:** A cheaper executor model (Sonnet 4.5, Haiku 4.5, GPT-4o, or similar) picking up this work cold.
**Source plan:** `/Volumes/X SSD 2025/Users/narrowchannel/.claude/plans/memoized-dreaming-journal.md`
**Repo:** `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/tmp-fix/`
**Owner / sole human approver:** William Roberts (`williamexpressway@gmail.com`)

---

## Read This First — Ground Rules

You are executing a multi-week diligence-prep workstream on the indiiOS codebase. The goal is to make this codebase ready for an acquirer's diligence team to walk in cold and reach an informed view. A more expensive model already did the thinking. Your job is execution. Do not re-derive the strategy. Do not re-explore the codebase. Do not propose alternatives. Use this document.

**You are NOT in plan mode.** You can edit, run tools, and commit (with William's approval per step). But you must follow the protocols below.

### Hard rules

1. **Stop and escalate to William, never guess**, when:
   - Any step requires a judgment call this runbook does not specify.
   - Any command's output does not match an expected pattern documented here.
   - Any file you're told exists does not exist (don't create it without confirming).
   - You hit a step marked `[ESCALATE]`.
   - Any test that was passing starts failing after your change.
   - You find a credential or secret you weren't expecting.

2. **Working directory is `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/tmp-fix/`**. Always use absolute paths. The directory `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/indiiOS-Alpha-Electron/src/` is **empty** (only `.DS_Store`). Never use it. The git repo root is `tmp-fix/`.

3. **Do not edit the customer-facing Founders covenant** in `src/config/founders.ts`. That's a separate program (10 customer founders, $2,500 lifetime seats). This runbook is about *William's* retention as the technical founder, which is unrelated. If you touch `founders.ts` you've gone off-track.

4. **Do not run anything destructive without William's approval**: no `git push --force`, no `git reset --hard`, no `rm -rf` outside `node_modules`/`dist`, no `firebase deploy`, no Stripe live-mode actions, no GitHub API writes.

5. **One workstream at a time.** Finish A before starting B. Do not interleave. Each workstream has a gate at the end — meet it before moving on.

6. **Token economy.** This file gives you everything you need. Do not re-read CLAUDE.md, do not explore directories you weren't told to explore, do not open files larger than 200 lines unless a step says to. The "Repo facts" section below replaces re-derivation.

7. **No commentary in deliverables.** When you produce a file from a template in this runbook, produce only the content. Don't add "I noticed that…" or "Based on my analysis…". If you have observations, put them in `.agent/EXECUTOR_NOTES.md` for William.

8. **Conventional commits.** Every commit message: `type(scope): subject`. Types: `chore`, `docs`, `fix`, `refactor`, `test`. No `Co-Authored-By` line — William is the sole declared contributor.

---

## Repo Facts (do not re-derive)

These are verified as of 2026-04-26. Trust them.

### Layout

- TS source: 268,130 LOC across 1,512 files under `tmp-fix/src/`
- Architecture: 3-layer (Directive → Orchestration → Execution) per `tmp-fix/CLAUDE.md`
- 17-agent hub-and-spoke fleet wired in `tmp-fix/src/services/agent/fine-tuned-models.ts`
- 35 lazy-loaded feature modules in `tmp-fix/src/modules/`
- 40+ services in `tmp-fix/src/services/`
- Firebase Functions in `tmp-fix/functions/src/`
- Electron wrapper in `tmp-fix/electron/`
- Python execution layer in `tmp-fix/python/` and `tmp-fix/execution/`

### Stack

- React 18 + Vite 6.4 (port **4242** for dev) + Tailwind 4.1 + Zustand 5
- Firebase Functions Gen 2 (Node 22) + Firestore + Stripe 20.1
- Vertex AI / Gemini via `@google/genai` 1.30
- Electron 33 desktop wrapper
- Vitest 4 (jsdom) + Playwright 1.57 (60+ E2E specs)

### Commands (copy-paste)

```bash
# All run from tmp-fix/
npm run dev                  # Vite dev server :4242
npm run build                # typecheck + lint + vite build
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint .ts,.tsx
npm test -- --run            # vitest single-shot
npm run test:e2e             # Playwright
```

### Test baseline (do not regress)

- Last known: **2,158 passed / 9 skipped / 0 failed** (`final_test_output.txt`, 2026-03-30)
- 460 test files
- After ANY change, re-run `npm test -- --run` and confirm pass count is ≥2,150 and failures = 0. If failed > 0, STOP and escalate.

### Git facts

- Origin: `https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron.git`
- Default branch: `main`
- Commit count: 4,271
- Top contributors:
  - `the-walking-agency-det` — 2,248 commits (= William)
  - `William Roberts` — 919 commits (= same William)
  - `google-labs-jules[bot]` — 874 commits
  - `Claude` — 165 commits
  - `github-actions[bot]` — 56 commits

### Identifiers (verified, do not re-look-up)

- DDEX Party ID: `PA-DPIDA-2025122604-E` (in `src/core/config/ddex.ts:6-26`)
- Party ID registered to: **"New Detroit Music LLC"** ⚠️ (does not match `IndiiOS LLC` in CLAUDE.md — **this is intentional finding A.3**, do not "fix" it)
- GCP project: `223837784072`
- 16 R7 Vertex endpoints live, 1 undefined (`keeper`)

---

## The Five Findings That Drive This Workstream

These are settled. Don't re-investigate.

| # | Finding | Severity | Workstream |
|---|---|---|---|
| 1 | God-mode email bypass hardcoded in 3 services | Must remediate | A.1 |
| 2 | `taxForms.ts` is a 39-line stub returning mock data | Document, defer | A.2 |
| 3 | DDEX Party ID registered to wrong-named entity | Document only | A.3 |
| 4 | No IP assignment / contributor docs / AI authorship disclosure | Must add | A.4 |
| 5 | 96.3% single-author concentration | Retention package | C |

---

## Workstream A — Pre-Diligence Remediation

Goal: fix the items an acquirer's first-pass review will flag. Each task ends with a verification step. Do not move on until verification passes.

### A.1 — God-Mode Bypass Refactor

**Problem:** the founder's email is hardcoded in code as a paywall bypass. An acquirer will see this and ask: "Who else's email is hardcoded? What other backdoors exist?" That question alone can knock 10–20% off the price.

**Files to change** (verified file:line):

- `src/services/MembershipService.ts:199` — first bypass
- `src/services/MembershipService.ts:383` — second bypass
- `src/services/subscription/SubscriptionService.ts:147` — payment override
- `src/core/config/ddex.ts:22` — keep as-is (this is a contact email, separate from bypass logic — leave it for A.3 to address as part of the entity reconciliation)

**Approach:**

The bypass capability stays — William needs it for demos. We change *how* it's checked. Replace the email-string comparison with a Firestore custom claim called `god_mode`. The claim is set by an admin-only Cloud Function that William invokes manually.

**Steps:**

1. Read `src/services/MembershipService.ts` to find the existing custom-claims read pattern. The membership tier is already pulled from claims somewhere — find it. If it doesn't exist as a pattern yet, find the closest analog in `functions/src/subscription/` and mirror it.

2. Replace the three `email === 'the.walking.agency.det@gmail.com'` checks with:
   ```ts
   const claims = await currentUser?.getIdTokenResult();
   if (claims?.claims?.god_mode === true) { return /* bypass */ }
   ```
   Keep behavior identical otherwise — same return values, same fall-through.

3. Add a new Cloud Function: `functions/src/admin/setGodMode.ts`. It must:
   - Be an `onCall` function gated on a hardcoded list of admin UIDs (start with William's only — get it from him via `[ESCALATE]`).
   - Take `{ uid: string, enabled: boolean }` as input.
   - Use `getAuth().setCustomUserClaims(uid, { ...existingClaims, god_mode: enabled })`.
   - Return `{ ok: true, uid, enabled }`.
   - Throw `permission-denied` if the caller is not in the admin list.
   - Log every invocation to a `god_mode_audit` Firestore collection with `{ caller, target, enabled, timestamp }`.

4. Add it to `functions/src/index.ts` exports (read first to see how other functions are exported).

5. Add a unit test: `src/services/MembershipService.god-mode.test.ts` that:
   - Mocks a user with `god_mode: true` claim — assert bypass triggers.
   - Mocks a user without the claim — assert no bypass.
   - Does NOT test against the hardcoded email (the email check is gone).

6. Search for any other hits: `grep -r "the.walking.agency.det@gmail.com" src/services functions/src` — must return 0 hits in code (configs and tests in `src/core/config/ddex.ts:22` only — that's the contact email, fine).

7. Run `npm test -- --run`. Pass count must be ≥2,150, failures = 0.

8. Commit:
   ```
   refactor(membership): replace hardcoded email bypass with god_mode custom claim

   - Remove hardcoded founder email from MembershipService and SubscriptionService
   - Add functions/src/admin/setGodMode.ts (admin-only, audited)
   - Add unit tests for claim-based bypass
   - Preserves bypass capability for founder demos
   ```

**[ESCALATE]** before step 3 — get William's Firebase UID. Do not guess.

**[ESCALATE]** if you find more than 4 occurrences of the founder email in `src/services` or `functions/src`. The runbook expected 3 (the ones above). More than that means the diligence inventory missed something.

**Verification (gate for A.1):**
- `grep -r "the.walking.agency.det@gmail.com" src/services functions/src` returns 0 hits.
- `npm test -- --run` shows the new tests passing and overall pass count ≥2,150 / failed = 0.
- New file `functions/src/admin/setGodMode.ts` exists with audit logging.

### A.2 — Tax Forms: Document, Don't Wire

**Problem:** `functions/src/stripe/taxForms.ts` is 39 lines and returns mock data. An acquirer's reviewer will spot this immediately.

**Decision (already made):** do not wire DocuSign + 1099 reporting now. Document it as a known gap. An honest gap doc reads better than a discovered stub.

**Steps:**

1. Create `tmp-fix/docs/KNOWN_GAPS.md` using the template below. Fill in only the tax-forms entry; leave the others as `<TBD by William>`.

2. Add `taxForms.ts` to a top-of-file comment marking it explicitly:
   ```ts
   /**
    * STATUS: STUB — NOT PRODUCTION READY
    * See docs/KNOWN_GAPS.md for remediation plan.
    * Triggered by: scaled launch with first 1099-eligible payout.
    */
   ```

3. Commit:
   ```
   docs: add KNOWN_GAPS.md and mark taxForms.ts as stub
   ```

**Template for `docs/KNOWN_GAPS.md`:**

```markdown
# Known Gaps

This document inventories code paths that are intentionally incomplete as of <DATE>.
It exists so that diligence reviewers do not need to discover gaps — they are surfaced
honestly with remediation triggers.

## Gap inventory

### G-001: Stripe 1099 / DocuSign tax forms (stub)

- **File:** `functions/src/stripe/taxForms.ts`
- **Status:** Returns mocked `Requested` status. No DocuSign integration. No real 1099 generation.
- **Why deferred:** No 1099-eligible payouts have occurred. US tax form requirement triggers at $600 USD/year per payee.
- **Trigger for remediation:** First payee crosses $600 lifetime payout in any calendar year.
- **Estimated effort:** 3–5 engineering days (DocuSign account, Stripe Connect 1099-K integration, Firestore audit log, admin UI for review).
- **Owner:** William Roberts.

### G-002: <next gap>
<TBD by William>

### G-003: <next gap>
<TBD by William>
```

**[ESCALATE]** to William: ask him to list any additional gaps he wants surfaced (mocked blockchain, anything else). Do not hunt for gaps yourself — that's a re-exploration the prior model already did. Just take William's additions and append them.

**Verification (gate for A.2):**
- `tmp-fix/docs/KNOWN_GAPS.md` exists with at least the G-001 entry.
- `taxForms.ts` has the STUB top-of-file comment.

### A.3 — Entity Structure Reconciliation

**Problem:** the DDEX Party ID is registered to "New Detroit Music LLC" but the company is documented as "IndiiOS LLC". Acquirer legal will catch this on day 1.

**This is not a code change.** It's a paperwork question for William.

**Steps:**

1. Create `tmp-fix/docs/ENTITY_STRUCTURE.md` using the template below. Fill in only the framing — William fills in the real answer.

2. **[ESCALATE]** to William: ask him to fill in section "Truth" with one of three answers:
   - (a) "New Detroit Music LLC owns the Party ID; IndiiOS LLC is a DBA / subsidiary. Filings attached."
   - (b) "New Detroit Music LLC is the legacy entity; we need to re-register the Party ID to IndiiOS LLC. Ticket open with DDEX Inc."
   - (c) "They are the same entity under two names. Operating agreement attached."

3. Commit (whatever William fills in):
   ```
   docs: add ENTITY_STRUCTURE.md reconciling DDEX Party ID and company name
   ```

**Template for `docs/ENTITY_STRUCTURE.md`:**

```markdown
# Entity Structure

**Last updated:** <DATE>
**Owner:** William Roberts

## Entities Referenced in This Codebase

| Name | Source | Role |
|---|---|---|
| IndiiOS LLC | `package.json`, `CLAUDE.md`, GitHub org references | Operating company |
| New Detroit Music LLC | `src/core/config/ddex.ts:8` (DDEX Party ID registration) | DDEX-registered entity |
| the-walking-agency-det | GitHub account / repository owner | William's personal GitHub identity |

## Truth

<William fills this in. Pick one of (a), (b), or (c) and attach supporting documents
in `docs/data-room/10_LEGAL/`.>

(a) New Detroit Music LLC is the legal entity that holds DDEX Party ID PA-DPIDA-2025122604-E.
    IndiiOS LLC is a [DBA / wholly-owned subsidiary / sister company] of New Detroit Music LLC.
    Operating agreement / DBA filing: <path>

(b) New Detroit Music LLC is a predecessor entity. The Party ID needs to be re-registered
    to IndiiOS LLC. DDEX Inc. ticket: <ticket #>. Expected resolution: <date>.

(c) New Detroit Music LLC and IndiiOS LLC are the same legal entity under two names.
    State filing showing both names: <path>

## Implications for Diligence

- Acquisition target = <one of: New Detroit Music LLC | IndiiOS LLC | a NewCo>
- IP assignment chain (see IP_ASSIGNMENT.md): <how it flows to the target>
- DSP commercial agreements signed under: <which entity name>
- Stripe / Firebase / GCP accounts owned by: <which entity>
```

**[ESCALATE]** before any commit — wait for William's answer. Do not guess. Do not file any DDEX tickets.

**Verification (gate for A.3):**
- `tmp-fix/docs/ENTITY_STRUCTURE.md` exists with William's `Truth` section filled in.
- If (b) was selected, a separate task is logged in `.agent/EXECUTOR_NOTES.md` to track the DDEX re-registration.

### A.4 — IP Assignment + Contributor Docs

**Problem:** there is no signed IP assignment, no contributor agreement, no AI-authorship disclosure. Acquirer cannot acquire what isn't owned.

**Files to create:**

- `tmp-fix/docs/IP_ASSIGNMENT.md`
- `tmp-fix/CONTRIBUTORS.md`
- `tmp-fix/docs/AI_AUTHORSHIP_DISCLOSURE.md`

**Templates below.** Fill in only what you can derive verbatim from this runbook. Everything else is `<TBD by William>` for him to complete with counsel.

**Template for `docs/IP_ASSIGNMENT.md`:**

```markdown
# IP Assignment Record

**Last updated:** <DATE>
**Status:** Draft pending counsel review.

## Purpose

This document records the chain of intellectual property ownership for the indiiOS
codebase. It is the document an acquirer's legal team reviews to confirm that the
acquisition target holds clean title to the code being acquired.

## Chain of Title

### Author → Entity Assignment

All code in this repository was authored by:

| Author | Role | Assignment Mechanism | Effective Date |
|---|---|---|---|
| William Roberts | Founder, sole human contributor (96.3% of human commits) | <Founder IP Assignment Agreement attached at docs/data-room/10_LEGAL/founder_ip_assignment.pdf> | <date> |
| <Contractor name, if any> | <role> | <contractor agreement> | <date> |

### AI-Generated Code

This repository contains commits authored by:

- `Claude` (Anthropic AI) — 165 commits
- `google-labs-jules[bot]` (Google AI) — 874 commits
- `github-actions[bot]` — 56 commits (CI tooling, no creative content)

Per Anthropic's Commercial Terms of Service and Google's Generative AI Terms,
output is owned by the user (William Roberts) and assigned to <IndiiOS LLC | New Detroit Music LLC>
under the same Founder IP Assignment Agreement above. See AI_AUTHORSHIP_DISCLOSURE.md.

### Third-Party Code

All third-party dependencies are listed in `package.json` (244 dependencies) and
are licensed permissively. License audit: <date>, performed by <reviewer>, report at
<path>. No GPL or AGPL contamination.

## Assignment Target

The legal entity holding all rights to this codebase is:

**<IndiiOS LLC | New Detroit Music LLC | TBD per ENTITY_STRUCTURE.md>**

## Verification by Reviewer

A reviewer can verify chain of title by:
1. Reading the Founder IP Assignment Agreement (attached).
2. Reading AI_AUTHORSHIP_DISCLOSURE.md.
3. Confirming `git log --format='%an' | sort -u` matches the contributors listed above.
4. Running `npx license-checker --production --summary` and confirming no copyleft licenses.
```

**Template for `CONTRIBUTORS.md`:**

```markdown
# Contributors

This repository is authored primarily by William Roberts. Significant tooling
contributions come from automated assistants under William's direction.

## Human Contributors

| Name | GitHub | Role | Period |
|---|---|---|---|
| William Roberts | the-walking-agency-det / williamexpressway | Founder, technical lead, sole human contributor | 2025-11-27 – present |

## AI Contributors (Tools, Not Authors)

These are AI assistants invoked by William as productivity tools. Their commits
represent code William reviewed and accepted. Output ownership is governed by
the respective providers' Commercial Terms of Service and assigned to the
project under William's Founder IP Assignment.

| Identity | Provider | Role |
|---|---|---|
| Claude | Anthropic | Pair programming, refactor, test generation |
| google-labs-jules[bot] | Google | Async task execution, larger refactors |
| github-actions[bot] | GitHub | CI/CD automation only — no creative authorship |

See `docs/AI_AUTHORSHIP_DISCLOSURE.md` for the full disclosure.
```

**Template for `docs/AI_AUTHORSHIP_DISCLOSURE.md`:**

```markdown
# AI Authorship Disclosure

**Last updated:** <DATE>
**Purpose:** Surface, before diligence asks, that this codebase contains code
generated by AI assistants under direct human supervision.

## What an Acquirer's Reviewer Will See

`git log --format='%an'` reveals these author identities:

- William Roberts — the founder
- the-walking-agency-det — also William (his GitHub account)
- Claude — Anthropic's AI assistant
- google-labs-jules[bot] — Google's async coding assistant
- github-actions[bot] — CI automation

Of ~3,288 commits with non-bot human authorship, William personally authored 96.3%.
The remainder are AI-assisted under his direction.

## Provider Terms (Verified)

### Anthropic (Claude)

Per Anthropic's Commercial Terms of Service (effective <date>), output generated
through the Claude API is owned by the customer who submitted the input. William
Roberts is the customer of record on the Anthropic account associated with these
commits. Output is therefore owned by William and assigned per his Founder IP
Assignment.

Reference: https://www.anthropic.com/legal/commercial-terms

### Google (google-labs-jules / Gemini)

Per Google's Generative AI Additional Terms of Service, the customer retains
rights to generated content. William is the account holder. Same assignment
chain applies.

Reference: https://policies.google.com/terms/generative-ai

### GitHub (github-actions[bot])

GitHub Actions runs CI workflows defined by William. No creative authorship.

## Why We Disclose This Proactively

A diligence reviewer running `git shortlog -sn` will discover the AI commits
within minutes. Surfacing this in the data room with provider-terms references
removes the surprise and short-circuits the question.

## Risk Posture

- **Provider clawback risk:** None. Both Anthropic and Google's terms grant
  customer ownership of outputs.
- **Copyright registrability:** AI-only output is generally not copyrightable
  in the US per current Copyright Office guidance. However, William's review,
  curation, and integration of AI output into the codebase establishes human
  authorship over the resulting work as a whole.
- **Trade-secret status:** Maintained — code is private repo, never published
  to AI providers as training data (Anthropic and Google both default to
  no-training for paid API tiers).
```

**Steps:**

1. Create the three files using the templates exactly as written. Fill in only date and verifiable facts; leave `<TBD>` markers for William.

2. Commit:
   ```
   docs: add IP assignment, contributors, and AI authorship disclosure
   ```

**[ESCALATE]** to William before merging — these documents need his counsel's review. Push to a branch, do NOT push to `main`. Open a PR or just leave the branch local until William says ship.

**Verification (gate for A.4):**
- All three files exist on a branch (not main yet).
- William has confirmed counsel review is in flight.

### Workstream A Gate

Before moving to B:
- [ ] A.1 verification passes (god-mode bypass refactored, tests green)
- [ ] A.2 verification passes (KNOWN_GAPS.md exists)
- [ ] A.3 verification passes (ENTITY_STRUCTURE.md exists with William's Truth section)
- [ ] A.4 verification passes (three docs on a branch, awaiting counsel)
- [ ] `npm test -- --run` shows ≥2,150 pass, 0 fail

If any gate fails, STOP and escalate.

---

## Workstream B — Independent Code Review Engagement

You cannot execute most of B yourself. It requires William to engage a third party. What you CAN do is prepare the briefing pack the reviewer will read on day 1.

### B.1 — Reviewer Scoping Document

Create `tmp-fix/docs/data-room/06_REVIEWER_SCOPE.md`:

```markdown
# Reviewer Scope of Work

**Engagement:** Independent technical due diligence
**Target:** indiiOS-Alpha-Electron repository
**Audience:** prospective acquirer's legal + technical advisors
**Reviewer engaged:** <TBD by William>
**Engagement period:** <TBD>

## Scope (focused review, not exhaustive)

The reviewer should NOT review all 268,130 LOC. Time-box the review to the
five asset surfaces that drive valuation:

### 1. DDEX Direct-Distribution Layer
**Files:** `src/services/ddex/`, `src/services/distribution/`, `execution/distribution/`
**Confirm:**
- ERN/DSR/MEAD/RIN implementations are spec-compliant (validate against published DDEX XSDs).
- Distributor adapters (CDBaby, DistroKid, Symphonic, TuneCore, UnitedMasters, Believe, ONErpm) are functional, not stubs.
- SFTP delivery code (`execution/distribution/sftp_uploader.py`) is hardened — no path traversal, credential leakage, or insecure host-key handling.

### 2. Agent Fleet Wiring
**Files:** `src/services/agent/fine-tuned-models.ts`, `src/services/agent/BaseAgent.ts`,
`src/services/agent/AgentService.ts`, `src/services/ai/FirebaseAIService.ts`
**Confirm:**
- All 16 R7 endpoints are reachable and respond within SLA (<5s p95).
- `FallbackClient.ts` strips Vertex endpoint URLs correctly when falling back to base Gemini.
- `AgentPromptBuilder.sanitizeTask()` covers documented injection patterns
  (NFKC normalize, Unicode tag strip, zero-width strip, 17 injection patterns).

### 3. Payment + Subscription
**Files:** `functions/src/stripe/`, `functions/src/subscription/`
**Confirm:**
- Webhook handling is idempotent (replay a webhook — no double-charge, no double-grant).
- Escrow split logic in `splitEscrow.ts` is mathematically correct.
- No client-side trust violations (price, tier, or amount come from server-side, not client metadata).

### 4. Security Surface
**Files:** `firestore.rules`, `storage.rules`, all `*Service.ts` that call Firestore
**Confirm:**
- Adversarial test: a non-owner cannot read/write another user's tracks, royalties, contracts.
- App Check enforcement is on in production.
- No secret patterns in git history (run TruffleHog over full history, not just HEAD).

### 5. Disabled Subsystems
**Confirm:**
- The god-mode bypass (post-A.1 remediation) is gated by `god_mode` custom claim and audited.
- Blockchain mock addresses are clearly marked as test-only.
- All Stripe live-mode keys are server-side only (no `sk_live_` in client bundles).

## Out of Scope

- UI / UX layer (separate review if buyer wants it).
- Marketing site (`landing-page/`).
- Training datasets (separate ML attestation).
- The 35 feature modules outside the five surfaces above.

## Deliverables Required from Reviewer

A signed PDF report with:
1. Executive summary aligned to or contradicting the valuation thesis (`00_VALUATION_THESIS.md`).
2. Findings by severity: Critical / Major / Minor / Informational.
3. Per-check verdict for each of the 12 checks listed in `06_VERIFICATION_CHECKS.md`.
4. Remediation list with effort estimates.

## Timeline

- Week 1: Reviewer onboarding, repo access provisioned.
- Weeks 2–3: Reviewer runs the 12 checks and writes findings.
- Week 4: Draft report → William review → reviewer revisions.
- Week 5: Final signed report delivered to `docs/data-room/06_INDEPENDENT_REVIEW.pdf`.

## Repo Access

- Read-only collaborator on `the-walking-agency-det/indiiOS-Alpha-Electron`.
- GCP read-only IAM on project `223837784072` (for endpoint reachability tests only).
- Stripe test-mode dashboard access (no live-mode access).
- Firebase test-project access (no production access).

## Cost Range

- Boutique technical-DD firm: $20,000–$50,000.
- Senior independent contractor: $5,000–$15,000.
- Recommended: boutique firm. Cost is a rounding error against asset value.
```

### B.2 — Verification Checklist

Create `tmp-fix/docs/data-room/06_VERIFICATION_CHECKS.md` listing the 12 checks the reviewer must run. Use the same 12 from the master plan §B.4. Copy them verbatim from `/Volumes/X SSD 2025/Users/narrowchannel/.claude/plans/memoized-dreaming-journal.md` lines 173–185.

**[ESCALATE]** at this point — wait for William to identify which reviewer he's engaging before any further B work.

### Workstream B Gate

- [ ] `06_REVIEWER_SCOPE.md` and `06_VERIFICATION_CHECKS.md` exist on the branch.
- [ ] William has named the reviewer and signed the engagement letter.
- [ ] Reviewer has been granted read-only access per the access list.

Stop here until William confirms.

---

## Workstream C — Founder Retention

You cannot draft the actual term sheet — that's William + outside counsel. What you CAN do is produce the skeleton he and his counsel will fill in.

### C.1 — Term Sheet Skeleton

Create `tmp-fix/docs/founder-retention/RETENTION_TERM_SHEET_TEMPLATE.md`:

```markdown
# Founder Retention Term Sheet (Template)

**Founder:** William Roberts
**Acquirer:** <TBD>
**Acquisition target:** <IndiiOS LLC | New Detroit Music LLC | NewCo per ENTITY_STRUCTURE.md>
**Headline price:** <TBD by negotiation>

---

## 1. Cash Component

- **Base salary:** $<250–500K> annually for <24–36> months, payable per acquirer's
  standard payroll cycle.
- **Signing bonus:** $<1–3 months base> paid on closing.
- **Annual bonus:** <eligibility> in acquirer's executive bonus pool, target
  <X%> of base.

## 2. Equity / Earnout Component

### Cliff-Vested Equity Grant

- **Grant:** $<value> in acquirer common/restricted stock.
- **Vesting:** 4-year vest, 1-year cliff.
- **Acceleration:**
  - Single-trigger acceleration on Change of Control: <yes/no>.
  - Double-trigger acceleration on involuntary termination without cause within
    24 months of Change of Control: <yes — recommended>.

### Performance Earnout

- **Earnout pool:** <30–40%> of headline acquisition price held in escrow.
- **Vesting period:** 18–36 months.
- **Milestones:** measurable metrics William directly controls. Recommended:
  - Active artist count on platform (e.g., 10K, 25K, 50K thresholds).
  - GMV through DDEX rail (e.g., $X royalties paid out).
  - Fine-tuned agent fleet uptime (≥99.5% per quarter).
  - Successor engineer onboarding milestones (see Knowledge Transfer section).
- **Forfeiture:** earnout forfeit on voluntary resignation without good reason
  before milestone period ends.

## 3. Role and Scope

- **Title:** CTO of acquired indiiOS unit (or equivalent VP-level title).
- **Reporting line:** Direct to acquirer's CEO or Chief Product Officer. Not
  embedded in a larger team.
- **Decision rights:**
  - Roadmap authority over indiiOS product line for 24 months minimum.
  - Veto right on rebranding or shutting down the indiiOS distribution rail
    during the earnout period.
  - Hiring authority for the indiiOS team within budgeted headcount.

## 4. Knowledge Transfer Milestones

These deliverables protect the buyer and structure earnout vesting:

| Month | Deliverable |
|---|---|
| 1 | `docs/ARCHITECTURE.md` — full 3-layer architecture, agent fleet, DDEX rail |
| 2 | `docs/RUNBOOKS.md` — production incident response procedures |
| 3 | Pair-programmed full DDEX onboarding cycle with buyer's team |
| 4 | Hand-off doc on Vertex fine-tuning pipeline (R1–R7 reproducibility) |
| 1–6 | Onboard 2 successor engineers identified by buyer |

Failure to deliver = earnout milestone forfeit.

## 5. Non-Compete and Carve-Outs

### Non-Compete

- **Scope:** Direct-to-DSP music distribution; AI-orchestrated artist tooling.
- **Duration:** 24 months from Change of Control.
- **Geography:** Global (consistent with platform).

### Permitted Activities

- Consulting for non-competing companies.
- Advising / investing in startups outside the scope above.
- Personal music production and recording.
- Pre-existing artistic projects (list to be attached).

### Customer-Founders Carve-Out

The acquirer agrees that the existing customer Founders Pass holders (per
`src/config/founders.ts`) retain the rights granted in `COVENANT_TERMS`
for the lifetime of the software, regardless of acquirer policy changes.
A side-letter formalizes this commitment.

---

## Shadow Appendix — Founder Comp Equivalent (Independent)

If the acquisition path is not pursued, this is what equivalent compensation
looks like as the independent CEO of indiiOS post-Series A:

- **Base salary:** $<X> (Series A norm: $200–250K for solo founder pre-Series B).
- **Equity:** retain founder shares; standard refresh grants on subsequent rounds.
- **Bonus:** discretionary, subject to board approval.
- **Earnout:** N/A — replaced by equity appreciation on subsequent rounds.

This shadow appendix exists so William can directly compare cash + risk-adjusted
equity value of the two paths during negotiation.

---

**Counsel review required before sharing with any external party.**
```

### C.2 — Succession Plan Skeleton

Create `tmp-fix/docs/founder-retention/SUCCESSION_PLAN.md`:

```markdown
# Succession Plan

**Last updated:** <DATE>
**Owner:** William Roberts

## Current State

William is the sole human contributor with 96.3% of human commits and the
sole holder of system-level knowledge for:

- The 3-layer architecture and its design rationale.
- The 17-agent fleet (R1–R7 fine-tune pipeline, dataset curation, Vertex
  endpoint wiring).
- The DDEX direct-distribution rail and DSP onboarding state.
- The Stripe Connect + escrow + subscription architecture.
- The Electron + Firebase + Genkit deployment topology.

## Successor Candidates

<William fills this in. The goal is to name at least one person, even if not
yet hired or formally engaged. A loose advisor or part-time contractor counts.>

| Candidate | Relationship | Domain coverage | Engagement status |
|---|---|---|---|
| <name> | <how William knows them> | <which areas they could pick up> | <None / Advisor / Contract / Hired> |

## Transition Timeline (post-acquisition or post-funding)

| Month | Activity | Owner |
|---|---|---|
| 1 | Architecture doc complete | William |
| 1–2 | Successor #1 onboarding (DDEX + distribution) | William → Successor #1 |
| 2–3 | Runbook doc complete | William |
| 3–4 | Successor #2 onboarding (Agent fleet + AI) | William → Successor #2 |
| 4–6 | William transitions to oversight role | William |
| 6+ | Successors operate independently with William as advisor | Successors |

## Bus-Factor Reduction Plan

The above transition reduces bus factor from 1 (William) to 3 (William +
2 successors). This is the metric an acquirer's risk team will track.
```

### C.3 — Architecture Document (William's Voice)

This is the most important pre-LOI deliverable. Create `tmp-fix/docs/ARCHITECTURE.md` populated from `tmp-fix/CLAUDE.md` content but rewritten in William's first-person voice as if he's narrating the system.

**[ESCALATE]** before you write this. Ask William: "Do you want me to draft this in your voice for you to edit, or do you prefer to write it from scratch?" The answer changes the deliverable shape.

### Workstream C Gate

- [ ] `RETENTION_TERM_SHEET_TEMPLATE.md` exists, sent to William's counsel.
- [ ] `SUCCESSION_PLAN.md` exists with at least one named successor candidate.
- [ ] William has confirmed his preferred approach for `ARCHITECTURE.md`.

---

## Workstream D — Data Room Assembly

This is the assembly step. By the time you reach D, you should have created most of the input artifacts in A, B, and C. D is just organizing them.

### D.1 — Initialize Directory Structure

Create the directory:

```
tmp-fix/docs/data-room/
├── 00_VALUATION_THESIS.md          # Copy from session valuation
├── 01_ARCHITECTURE.md              # Symlink or copy from docs/ARCHITECTURE.md
├── 02_ENTITY_STRUCTURE.md          # From A.3
├── 03_IP_ASSIGNMENT.md             # From A.4
├── 04_AI_AUTHORSHIP_DISCLOSURE.md  # From A.4
├── 05_KNOWN_GAPS.md                # From A.2
├── 06_INDEPENDENT_REVIEW.pdf       # From B (placeholder until reviewer delivers)
├── 06_REVIEWER_SCOPE.md            # From B.1
├── 06_VERIFICATION_CHECKS.md       # From B.2
├── 07_DDEX_PROOF/                  # Empty; William populates with Party ID cert + sample ERNs
├── 08_DSP_RELATIONSHIPS.md         # Skeleton; William populates per-DSP state
├── 09_FINANCIALS/
│   ├── acquisition/                # Asset value + retention cost framing
│   └── series_a/                   # Burn + path to profitability framing
├── 10_LEGAL/                       # William drops contracts here
├── 11_RETENTION_TERM_SHEET.md      # From C.1
├── 12_SUCCESSION_PLAN.md           # From C.2
└── 13_OPEN_RISKS.md                # Last — written after everything else
```

### D.2 — Templates for the Two Items Not Yet Drafted

**`08_DSP_RELATIONSHIPS.md`:**

```markdown
# DSP Relationships

**Last updated:** <DATE>
**Owner:** William Roberts

## Per-DSP Status

| DSP | DDEX Channel | Onboarding Status | Live Deliveries | Notes |
|---|---|---|---|---|
| Spotify | Direct via Party ID | <TBD by William> | <TBD> | <TBD> |
| Apple Music | Direct via Party ID | <TBD> | <TBD> | <TBD> |
| Amazon Music | Direct via Party ID | <TBD> | <TBD> | <TBD> |
| Tidal | Direct via Party ID | <TBD> | <TBD> | <TBD> |
| Deezer | Direct via Party ID | <TBD> | <TBD> | <TBD> |
| Merlin | Aggregated | <TBD> | <TBD> | <TBD> |
| (Legacy aggregator) DistroKid | Pass-through | <TBD> | <TBD> | <TBD> |
| (Legacy aggregator) CDBaby | Pass-through | <TBD> | <TBD> | <TBD> |
| (Legacy aggregator) TuneCore | Pass-through | <TBD> | <TBD> | <TBD> |
| (Legacy aggregator) Symphonic | Pass-through | <TBD> | <TBD> | <TBD> |

## Onboarding Status Definitions

- **Not started:** No contact with DSP.
- **In discussion:** Initial conversations, no DDEX onboarding ticket.
- **Ticket open:** DDEX onboarding ticket filed, awaiting DSP-side action.
- **Test deliveries:** Test ERNs accepted; production deliveries not yet live.
- **Live:** Production deliveries flowing. Royalty reports being received.

## Why This Matters for Diligence

The valuation thesis assumes the DDEX rail is operational. The truth is per-DSP.
"Live" deliveries to Spotify + Apple is the minimum viable claim; anything less
materially affects valuation. This document forces honesty about which DSPs are
live versus theoretical.
```

**`13_OPEN_RISKS.md`:**

```markdown
# Open Risks

**Last updated:** <DATE>

This document lists every known risk that has not been remediated. It exists
to prevent reviewers from "discovering" risks we already know about.

## Risk Inventory

### R-001: Single-author concentration
- **Severity:** High
- **Description:** William Roberts is 96.3% of human commits. Bus factor = 1.
- **Mitigation in progress:** See SUCCESSION_PLAN.md.
- **Status:** Cannot be eliminated pre-acquisition; can only be reduced.

### R-002: Entity name mismatch on DDEX Party ID
- **Severity:** Medium
- **Description:** Party ID PA-DPIDA-2025122604-E registered to New Detroit Music LLC; codebase declares IndiiOS LLC.
- **Mitigation in progress:** See ENTITY_STRUCTURE.md for resolution.
- **Status:** <Resolved | Pending re-registration | Ambiguous>.

### R-003: Tax form generation is a stub
- **Severity:** Low (until first 1099-eligible payout)
- **Description:** functions/src/stripe/taxForms.ts returns mock data.
- **Mitigation:** Documented in KNOWN_GAPS.md G-001.
- **Status:** Deferred until trigger.

### R-004: <next>
<TBD by William>
```

### Workstream D Gate

- [ ] `tmp-fix/docs/data-room/` directory exists with all entries from D.1.
- [ ] All template files have at least skeleton content (no empty files).
- [ ] William has reviewed and tagged the data room as ready for dry-run advisor review.

---

## What to Tell William When You're Done

After completing each workstream, append a status line to `.agent/EXECUTOR_NOTES.md`:

```
[YYYY-MM-DD HH:MM] Workstream X.Y complete. Verification: <pass/fail>. Notes: <brief>.
[YYYY-MM-DD HH:MM] [ESCALATED] Workstream X.Y blocked on: <question>. Reason: <why>.
```

When all workstreams are gated complete, write `.agent/HANDOFF_COMPLETE.md` with:
- A summary of what got done.
- What's still pending William action (counsel reviews, William's TBD fill-ins).
- A diff stat (`git diff main --stat`) showing the changes.

Then stop.

---

## Stop Conditions

You STOP and write `.agent/BLOCKED.md` (containing: which step / exact command / exact
output / one-line guess of cause / "Awaiting William") if:

1. Any verification gate fails and the failure is not in this runbook's expected
   patterns.
2. Any `[ESCALATE]` step is hit and William is not available.
3. You discover a credential/secret in the codebase that is not already documented.
4. You find more than the documented number of god-mode email occurrences (>4 hits in src/services + functions/src).
5. Test count drops below 2,150 passing or any test goes from passing to failing
   after your change.
6. You hit any rate limit or tool error you cannot recover from.
7. You're tempted to "improve" something not in this runbook. Stop. That's the
   prior model's job.

---

## Token-Economy Rules

You are a cheaper model on a budget. Follow these:

- **Don't read CLAUDE.md again.** All needed facts are above.
- **Don't read files >200 lines unless this runbook says to.**
- **Don't run `find` over the whole repo.** All paths are listed above.
- **Don't run `npm install`** — assume `node_modules` exists. If it doesn't, escalate.
- **Don't run `npm run dev`** unless a step says to.
- **Don't run `npm test` more than required by verification gates.** Each run takes ~5 minutes.
- **Don't write commentary into deliverables** beyond what templates specify.
- **Don't expand scope.** If a finding feels related to but outside this runbook, log it in `.agent/EXECUTOR_NOTES.md` for William and move on.

---

## Glossary

- **DDEX:** Digital Data Exchange — the music industry standard for delivering metadata and audio to DSPs.
- **DSP:** Digital Service Provider (Spotify, Apple Music, Amazon Music, etc.).
- **ERN:** Electronic Release Notification — the DDEX message type that announces a release to DSPs.
- **DSR:** Digital Sales Report — the DDEX message type DSPs send back with sales/streams data.
- **Party ID:** Globally unique identifier issued by DDEX to a registered entity (label, distributor). Required to deliver directly to DSPs.
- **Acquirer:** A company buying indiiOS. Could be a major label, a DSP, an aggregator, an AI platform, or a creative-tools company.
- **LOI:** Letter of Intent — the non-binding document that opens an acquisition negotiation.
- **Earnout:** A portion of the acquisition price held in escrow and released against post-close milestones.
- **Bus factor:** The number of people who can be hit by a bus before the project dies. indiiOS bus factor = 1.

---

**END OF RUNBOOK.**
