---
name: /mega-test
description: >
  Execute a specific version of the Mega Stress Test Plan using the browser subagent,
  measuring against 11 dimensions including deep technical architecture, asset generation,
  and real artifact validation.
  Runs numbered routines sequentially, documents pass/fail per routine, logs new issues
  to OPEN_ISSUES.md, and produces a structured test report.
  TEST AGENT DOES NOT WRITE CODE. Issues go to OPEN_ISSUES.md for a fixing agent.
---

# /mega-test — Multi-Dimensional Mega Stress Test Execution Protocol

> **Purpose:** Execute numbered routines from a specific Mega Stress Test plan file against the live running application using the browser subagent. Evaluate the application across 11 critical dimensions.
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications, no source reading. EVER.
> **Output:** Multi-dimensional pass/fail report + all new issues → `OPEN_ISSUES.md`

---

## 0. PRIME RULES (READ BEFORE ANYTHING ELSE)

You are a **multi-dimensional test executor**, not an engineer. For every routine, you observe through ALL 11 lenses simultaneously.

You DO:
- Open the browser subagent and navigate the live app
- Execute each routine's exact steps as written in the plan
- Validate real outputs (images, videos, PDFs) end-to-end
- Screenshot every meaningful state, error toast, and failure
- Report PASS, PARTIAL, or FAIL per routine with dimensional scores
- Append new issues to `OPEN_ISSUES.md` using the standard format

You do NOT:
- Read source code
- Modify any files (except appending to `OPEN_ISSUES.md` and the test report)
- Run terminal commands other than checking the app is running
- Diagnose root causes or suggest code fixes
- Skip routines because they "seem fine" — every routine must execute

**Technology Snapshot Check:**
- Framework: React 18.3.1 (Concurrent mode)
- State: Zustand 5.0.8 (28 slices)
- Build: Vite 6.4.2 / Electron-Vite 5.0.0
- AI: Gemini 3 Pro/Flash Preview models (strict policy)
- Backend: Firebase Gen 2 Cloud Functions

Before executing ANY routine, read the Architecture Snapshot (Section 8.1) to understand what the code SHOULD do.

---

## 1. INITIALIZATION

### Step 0 — Technology Snapshot
Verify current system matches the expected tech stack:
```bash
npm ls react zustand vite
```

### Step 1 — Determine which test plan or department to run
Read the user's input:
| Input | Behavior |
|-------|---------|
| `/mega-test` (no args) | Run the highest-version plan found in `.agent/test_ledger/` |
| `/mega-test v4` | Run `MEGA_STRESS_TEST_V4_REGRESSION.md` |
| `/mega-test v4 section 3` | Run only Section 3 of V4 |
| `/mega-test v4 101-110` | Run only routines 101–110 of V4 |
| `/mega-test regression` | Run all routines tagged `[REGRESSION]` across all plans |
| `/mega-test marketing` | Run the scoped department tests (unit, integration, E2E, and connections) for the Marketing department using `python3 execution/run_department_test.py marketing` |
| `/mega-test-audio`, `/mega-test audio`, `/mega-test MegaTestAudioLoop` | Run the scoped audio system gauntlet using `python3 execution/run_department_test.py audio-analyzer`, including Audio Analyzer UI, audio services, Firebase audio API tests, agent audio tools, distribution/DDEX audio paths, Python audio forensics checks, fixtures, and connected Creative/Marketing/Distribution coverage |
| `/mega-test <department>` | Run tests scoped by department name or alias (e.g., creative, finance, distribution, legal, publishing) |

### Step 2 — Read the target test plan in full
```bash
cat .agent/test_ledger/MEGA_STRESS_TEST_V<N>_*.md
```
Build a mental checklist of modules, actions, and PASS conditions.

### Step 3 — Read OPEN_ISSUES.md
```bash
tail -30 .agent/test_ledger/OPEN_ISSUES.md
```
Note the last ISSUE number. Any new issues start at the next number.

### Step 4 — Confirm the app is running
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4242
```
If not 200, ask the user to start the dev server (`npm run dev:web`).

### Step 5 — Console Baseline
Open the browser subagent, navigate to `http://localhost:4242`. Record ALL console messages on initial load as the BASELINE. Any new console errors during testing = new findings.

### Step 6 — Read Flowchart Index
Scan `docs/flowcharts/` to build a mental map of key architectural invariants.

### Step 7 — Check Slash Command Availability
Verify `/hunter`, `/issue`, `/real`, `/auto_qa`, `/flowchart`, `/health_audit`, `/factory`, `/ci-validate` exist in `.agent/workflows/`.

### Step 8 — Read REAL_TEST_HISTORY.md
Load the coverage history to prioritize under-tested areas.

---

## 2. EXECUTION PROTOCOL

### 2.1 Routine Execution Loop
For each routine in the test plan:
1. **Read the routine** — understand the full scenario.
2. **Navigate** — get to the correct module using the sidebar.
3. **Execute** — follow the exact steps.
4. **Observe** — watch for PASS/FAIL conditions across all 11 Dimensions.
5. **Screenshot** — capture final state (pass or fail).
6. **Record** — append to running test report with dimensional scores.
7. **Log issues** — if FAIL or PARTIAL, append to `OPEN_ISSUES.md`.

### 2.2 Browser Subagent Usage Rules
When calling `browser_subagent`:
- Provide the full routine text as task context.
- Specify the exact PASS condition.
- Ask for console error reporting.
- Request a screenshot at the end.
- Set generous timeouts for AI generation routines (2+ minutes).

### 2.3 Verdict Definitions
| Verdict | When to Use |
|---------|-------------|
| ✅ PASS | PASS condition fully met. No errors, no deviations. |
| ⚠️ PARTIAL | Works but with degradation (slow, console warning, visual glitch). |
| ❌ FAIL | PASS condition NOT met, OR blocking console error. |
| 🔵 OPEN | Already-open issue. Document current state. |
| 🚫 BUDGET_HOLD | Stopped due to API costs exceeding budget. |

### 2.4 Regression Detection
If a routine maps to a previously `✅ FIXED` issue and fails:
1. Mark `❌ FAIL [REGRESSION]`.
2. File a new issue with `Severity: 🔴 HIGH`.

---

## 3. THE 11 DIMENSIONS

You evaluate every routine across these 11 lenses.

### Dimension 1: Performance Profiling
1. Measure page load time (start → interactive).
2. Record memory usage via DevTools.
3. Re-measure memory after 5 minutes (detect leaks).
4. Check for layout shifts during transitions.
5. Time AI responses.
*Budgets: Load < 3s, Switch < 500ms, AI First Token < 5s, No CLS.*

### Dimension 2: Accessibility Audit
1. Run axe-core scan.
2. Tab through elements — verify focus ring.
3. Verify alt text on images.
4. Verify accessible names on buttons.
5. Check color contrast (4.5:1).
*Severity: Missing alt text = HIGH, Contrast = MEDIUM.*

### Dimension 3: Security Surface Testing
1. Check for exposed API keys in network (sk_, ghp_, AIza).
2. Auth tokens not in URLs.
3. Test protected routes unauthenticated.
4. Check CSP headers.
*Red Flags: API key exposed = ❌ FAIL.*

### Dimension 4: Architecture Validation (Flowchart-Driven)
Verify the live app matches `docs/flowcharts/`.
- Validate app layers (entire-app-architecture.md).
- Validate state management (zustand-state-architecture.md).
- Validate creative flow (creative-studio-pipeline.md).

### Dimension 5: State Management Integrity
- Verify Zustand state persists across module navigation.
- Detect subscription leaks (rapidly switch modules, check memory).
- Verify slice isolation (actions in Creative don't re-render Finance).

### Dimension 6: AI/Agent Integrity
- Model Policy: Verify banned models are NOT used (gemini-1.5*, gemini-2.0*, gemini-pro*).
- Verify approved models ARE used (gemini-3*, veo-3.1*).
- Verify Agent Orchestrator (Conductor) delegates correctly.

### Dimension 7: Cross-Module Data Flow
Verify assets are visible where needed:
- Creative Image → Video Producer, Distribution, Brand Kit.
- Audio DNA → Distribution Metadata.

### Dimension 8: Responsive & PWA
Test viewport breakpoints:
- 1920px (Desktop), 1280px (Laptop), 768px (Tablet), 375px (Mobile).
- Verify no horizontal scrollbars, touch targets ≥ 44x44px.
- PWA: manifest.json valid, service worker active.

### Dimension 9: Production Parity
- Compare `.env` to production.
- Verify `VITE_SKIP_ONBOARDING` is off in prod logic.
- Verify App Check token requirements.

### Dimension 10: Console Intelligence
Classify all console messages:
- 🔴 CRITICAL (Unhandled Rejection, TypeError) → HIGH issue.
- 🟡 WARNING (React key, deprecated) → MEDIUM issue.
- React 18 specific: Catch "Cannot update component while rendering", "unique key", "suspense boundary" errors.

### Dimension 11: Asset Generation Gauntlet (The Generative Crucible)
Every endpoint that CREATES a real artifact MUST be tested end-to-end.
**Procedure:**
1. TRIGGER generation.
2. WAIT (generous timeouts).
3. VERIFY ARTIFACT: Real (not undefined/placeholder), correct MIME, VISIBLE in UI, PLAYABLE/DOWNLOADABLE.
4. USE DOWNSTREAM: Verify it can be used in another module.

**Key Chain Tests (End-to-End):**
- Logo → T-Shirt Mockup (`mockup_merchandise`).
- Image → Video (`generateVideoV3`).
- Audio → DNA → Distribution.
- Contract → PDF → Signature.
- Full Artist Lifecycle (Gauntlet): Logo → Art → Merch → Split Sheet → PR → Release → DDEX.

*Cost Awareness:* Respect API budgets. Use `check_budget_status()`.

---

## 4. MODULE NAVIGATION GUIDE

Use explicit sidebar paths:
- Boardroom: "Boardroom HQ"
- Creative Director: "Creative Director"
- Audio Analyzer: TOOLS > "Audio Analyzer"
- Workflow Builder: TOOLS > "Workflow Builder"
- Finance: "Finance"
- Marketing: "Marketing"
- Distribution: "Distribution"
Expand the sidebar if tools are hidden.

---

## 5. TEST REPORT FORMAT

Maintain a running report, finalize as an artifact `artifacts/mega_v<N>_<date>_results.md`.

```markdown
# Mega Stress Test V<N>.0 Execution Report

**Date:** <ISO date>
**Plan:** MEGA_STRESS_TEST_V<N>_*.md
**Routines Executed:** <X> of <Y> total

## Dimensional Health Matrix

| Dimension | Score | Critical | Warning | Pass | Notes |
|-----------|-------|----------|---------|------|-------|
| Performance | 🟢 8/10 | 0 | 2 | 8 | Memory growth in Creative |
| Accessibility | 🟡 6/10 | 1 | 3 | 6 | Missing alt text |
| [All 11 Dimensions] | ... | ... | ... | ... | ... |
| **OVERALL** | **🟡 85/110** | **2** | **20** | **88** | **Target: 100/110** |

## Asset Generation Scorecard
| Endpoint | Status | Time | Downstream |
|----------|--------|------|------------|
| generateImageV3 | ✅ PASS | 4.2s | Used as cover art |
| ... | ... | ... | ... |

## Architecture Violation Log
- [VIOLATION-001] Video pipeline skips canvas step

## Per-Routine Entry
### Routine <N>: <Title>
- **Verdict:** ✅ PASS
- **Duration:** ~<seconds>s
- **Observed:** <what happened>
- **Dimensional Scores:** [Table of 11 scores]
- **New issue filed:** ISSUE-NNN

## New Issues Filed
- ISSUE-NNN: <title> (<severity>)
```

---

## 6. ISSUE FILING FORMAT (OPEN_ISSUES.md)

Append to `.agent/test_ledger/OPEN_ISSUES.md`. DO NOT edit existing entries.

```markdown
### ISSUE-<NNN>: <Short title>
- **Status:** OPEN
- **Severity:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
- **Dimension:** Performance | Accessibility | Security | Architecture | State | AI | DataFlow | Responsive | ProdParity | Console | AssetGen
- **Module:** <module name>
- **Flowchart:** <flowchart file> | N/A
- **Tech Stack:** React 18.3.1 | Zustand | Vite 6.4.2 | Firebase | N/A
- **Found:** <YYYY-MM-DD> by Mega Stress Test V<N> (Routine <N>)
- **Summary:** <description>
- **Steps to Reproduce:** ...
- **Expected:** ...
- **UX Impact:** ...
- **Dimensional Data:** <Metrics from failing dimensions>
```

---

## 7. SLASH COMMAND INTEGRATION

Test Orchestration Pipeline:
- **BEFORE:** `/health_audit` (snapshot), `/flowchart` (architecture map)
- **DURING:** `/hunter audit` (if ≥5 security issues), `/auto_qa` (after sections)
- **AFTER:** `/issue triage` (auto-triage), `/ci-validate` (test regressions), `/go` (snapshot)
- **OPTIONAL:** `/factory` (closed-loop), `/real deep <module>`

---

## 8. FLOWCHART VALIDATION ENGINE

Read flowcharts in `docs/flowcharts/` and extract invariants. Verify them live.
- `entire-app-architecture.md`: 6 layers operational.
- `zustand-state-architecture.md`: 10 slices isolated.
- `creative-studio-pipeline.md`: Generate → Edit → Canvas → Save.
File `ARCHITECTURE_VIOLATION` issues for deviations.

---

## 9. TECHNOLOGY-AWARE TESTING

Specific routines for exact stack versions:
- **React 18.3.1:** Concurrent rendering, automatic batching, suspense boundaries, strict mode double-renders.
- **Zustand 5.0.8:** Shallow equality checks, 28-slice stress tests, persistence survival.
- **Vite 6.4.2 / Tailwind 4.1.17:** HMR speed, chunk splitting, class collision.
- **Firebase Gen 2:** Firestore rule drops, app check tokens, cold starts.

---

## 10. QUICK REFERENCE

```
/mega-test                  → Run highest-version plan, all routines
/mega-test v4               → Run V4 plan, all routines
/mega-test regression       → Run only [REGRESSION]-tagged routines

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Append new issues HERE
  artifacts/mega_v<N>_<date>_results.md      ← Session test report
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Append one-line summary
```

---

## 11. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Skipping a routine because it "looks fine" | Every routine must run. The PASS condition is not assumed. |
| Failing to verify downstream Asset flow | An image generated but not usable in Distribution is a FAIL. |
| Filing vague issues | Every issue needs exact steps to reproduce and Dimension tags. |
| Marking PARTIAL when it's clearly FAIL | Do not soften failures. |
| Running all 35 routines in one browser call | Split into sections. Browser subagent has limits. |
| Ignoring console errors on PASS | A "working" feature with an Unhandled Promise Rejection is a FAIL. |
