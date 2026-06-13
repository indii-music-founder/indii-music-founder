---
name: /mega-test
description: >
  Execute a full multi-dimensional stress test against ONE left-menu item — a manager,
  department, tool, or project/dashboard — named as the fill-in-the-blank target.
  Example: `/mega-test road-manager`, `/mega-test audio-analyzer`, `/mega-test marketing`.
  The target taxonomy is the live sidebar, defined in `.agent/test_ledger/departments_test_config.json`.
  Runs the scoped test surface (Vitest unit/integration + Playwright E2E + connections) via
  `execution/run_department_test.py <target>`, then drives the 12-dimension browser gauntlet
  against the live module, documents pass/fail, logs new issues to
  `.agent/test_ledger/OPEN_ISSUES.md`, and produces a structured per-target report.
  TEST AGENT DOES NOT WRITE CODE. Issues go to .agent/test_ledger/OPEN_ISSUES.md for a fixing agent.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.


# /mega-test — Per-Menu-Item Multi-Dimensional Stress Test

> **Purpose:** Test ONE left-menu item end-to-end against the live running application using the browser subagent, across 12 critical dimensions, plus its scoped unit/E2E/connection test surface.
> **The unit of work is a menu item, NOT a version number.** `/mega-test road-manager`, not `/mega-test v5`.
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications, no source reading. EVER.
> **Output:** Per-target pass/fail report + all new issues → `.agent/test_ledger/OPEN_ISSUES.md`

---

## 0. PRIME RULES (READ BEFORE ANYTHING ELSE)

You are a **multi-dimensional test executor**, not an engineer. For the target menu item, you observe through ALL 12 lenses simultaneously.

You DO:
- Resolve the user's target to a registry entry (manager / department / tool / project)
- Run the scoped test surface via `python3 execution/run_department_test.py <target>`
- Open the browser subagent and navigate the live app to that exact module
- Validate real outputs (images, videos, PDFs) end-to-end
- Screenshot every meaningful state, error toast, and failure
- Report PASS, PARTIAL, or FAIL per routine with dimensional scores
- Append new issues to `.agent/test_ledger/OPEN_ISSUES.md` using the standard format

You do NOT:
- Read source code
- Modify any files (except appending to `.agent/test_ledger/OPEN_ISSUES.md` and the test report)
- Run terminal commands other than the scoped runner and checking the app is running
- Diagnose root causes or suggest code fixes
- Skip the target's connected modules — every menu item flows data somewhere

**Technology Snapshot Check:**
- Framework: React 18.3.1 (Concurrent mode)
- State: Zustand 5.0.8 (28 slices)
- Build: Vite 6.4.2 / Electron-Vite 5.0.0
- AI: Gemini 3 Pro/Flash Preview models (strict policy)
- Backend: Firebase Gen 2 Cloud Functions

---

## 1. THE TARGET TAXONOMY (THE FILL-IN-THE-BLANK)

Every `/mega-test` invocation names ONE left-menu item. The authoritative list of targets, their aliases, and their scoped test surfaces lives in **`.agent/test_ledger/departments_test_config.json`** — that registry is the single source of truth and mirrors the live sidebar in [Sidebar.tsx](packages/renderer/src/core/components/Sidebar.tsx).

The menu is organized into four categories. Any item below is a valid fill-in-the-blank:

### Manager's Office (`category: manager`)
| Target | Aliases |
|--------|---------|
| Brand Manager | `brand`, `brand-manager`, `branding` |
| Road Manager | `road`, `road-manager`, `touring` |
| Campaign Manager | `campaign`, `campaign-manager` |
| Booking Agent | `agent`, `booking-agent` |
| Publicist | `publicist`, `pr-agent` |
| Creative Director | `creative`, `creative-director`, `a&r`, `art` |

### Departments (`category: department`)
| Target | Aliases |
|--------|---------|
| Marketing & PR | `marketing`, `social-media`, `pr` |
| Social Media Department | `social`, `social-media` |
| Legal Department | `legal`, `contracts` |
| Publishing Department | `publishing` |
| Finance Department | `finance`, `royalties`, `royalty` |
| Distribution Department | `distribution` |
| Licensing Department | `licensing` |
| Art & Merch Dept | `merch`, `merchandise`, `art-merch` |
| Registration Center | `registration` |
| Security Agent | `security` |

### Tools (`category: tool`)
| Target | Aliases |
|--------|---------|
| Workflow Builder | `workflow`, `workflows` |
| Audio Analyzer | `audio-analyzer`, `audio`, `analyzer`, `mega-test-audio`, `MegaTestAudioLoop` |
| Knowledge Base | `knowledge` |
| Memory Agent | `memory` |
| Command Center | `observability`, `command-center` |
| Settings | `settings`, `preferences` |
| Mobile Remote | `mobile-remote`, `remote`, `controller` |

### Projects & Dashboards (`category: project`)
| Target | Aliases |
|--------|---------|
| HQ Dashboard | `dashboard`, `hq`, `projects` |
| Boardroom HQ | `boardroom`, `swarm` |
| Founders Checkout | `founders`, `checkout` |
| Onboarding | `onboarding`, `curriculum` |

### Right Bar — Omni-Panel tabs (`category: rightbar`)
The right-side panel ([RightPanel.tsx](packages/renderer/src/core/components/RightPanel.tsx)) is testable per tab.
| Target | Aliases |
|--------|---------|
| Context Controls | `context-controls`, `context`, `studio-controls` |
| Project Assets | `project-assets`, `assets` |
| Artifacts | `artifacts`, `artifacts-panel` |
| Omni Agent | `omni-agent`, `omni`, `agent-panel` |

### Top Bar — per-module top toolbars / dropdown menus (`category: topbar`)
The top toolbar that appears above a module's content (e.g. the Creative Studio top menu with dropdowns).
| Target | Aliases |
|--------|---------|
| Creative Studio Top Toolbar | `creative-toolbar`, `canvas-toolbar`, `studio-toolbar` |
| Design Top Toolbar | `design-toolbar` |
| Agent Top Toolbar | `agent-toolbar` |
| Marketing Top Toolbar | `marketing-toolbar` |

### Continuity Chains — backend cross-pollination of information (`category: continuity`)
These targets are NOT a single UI surface. Each is an end-to-end **information chain**: a fact captured in one place must propagate through the memory/profile layer and be *acted on* by a downstream agent — possibly across time. See §12 for the chain test discipline.
| Target | Chain |
|--------|-------|
| `chain-aesthetic` | Preference captured (onboarding/settings) → memory → Creative/Brand/Merch *uses* it (e.g. favorite color "puke green" becomes the aesthetic) |
| `chain-longitudinal-finance` | Spend history accumulates over time → aggregated → surfaced as an insight (e.g. 3 yrs of guitar-string spend → "look for a sponsor") |
| `chain-identity` | Artist profile/identity facts → propagate to ALL agents (brand, creative, marketing, publicist, legal) consistently |

> **The registry is canonical — these tables are a convenience snapshot.** At startup, dump the live registry to confirm targets and aliases:
> ```bash
> python3 execution/run_department_test.py --help && \
>   python3 -c "import json; c=json.load(open('.agent/test_ledger/departments_test_config.json')); [print(v.get('category'),'|',k,'|',v.get('name'),'| aliases:',v.get('aliases',[])) for k,v in c.items()]"
> ```
> If the user names something not in the registry, list the valid targets (the runner prints them on a miss) and ask which they meant.

---

## 2. INVOCATION SYNTAX

```
/mega-test road-manager          → Full gauntlet against the Road Manager menu item
/mega-test audio-analyzer        → Full gauntlet against Audio Analyzer (audio system)
/mega-test marketing             → Full gauntlet against the Marketing department
/mega-test boardroom             → Full gauntlet against Boardroom HQ
/mega-test                       → No target: list the registry and ask which item to run
/mega-test road-manager --deep v5  → Attach a heavier numbered depth-pack (see §9)
/mega-test road-manager --no-browser → Scoped runner only, skip the live browser gauntlet
```

`/mega-test <category>` (e.g. `/mega-test managers`, `/mega-test departments`, `/mega-test tools`)
sweeps every item in that category one at a time. To sweep the **entire menu**, use `/mega`.

---

## 3. INITIALIZATION

### Step 1 — Resolve the target
Read the user's argument. Resolve it to exactly one registry key via name or alias. If it resolves to a category, expand to the list of items and run them sequentially. If no target was given, print the registry and ask.

### Step 2 — Run the scoped test surface
```bash
python3 execution/run_department_test.py <target>
```
This executes the target's Vitest unit/integration tests, Playwright E2E specs, configured Python checks, and **connected-integration** tests. Capture the results — failures here become issues just like browser findings. Use `--dry-run` first if you want to see the surface before spending time.

### Step 3 — Read .agent/test_ledger/OPEN_ISSUES.md
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
Open the browser subagent, navigate to `http://localhost:4242`. Record ALL console messages on initial load as the BASELINE. Any new console errors when you open the target module = new findings.

### Step 6 — Read Flowchart Index
Scan `docs/flowcharts/` for invariants touching this target (its module + every module it connects to).

---

## 4. EXECUTION PROTOCOL

### 4.1 Per-Target Loop
1. **Navigate** — open the target module via its sidebar path (§5).
2. **Exercise the surface** — every button, input, generation trigger, and persisted state in the module.
3. **Follow the connections** — the registry lists connected modules. Verify data flows out (e.g. Creative image → Distribution; Road Manager itinerary → Calendar/Finance).
4. **Observe** — watch PASS/FAIL across all 12 Dimensions (§6).
5. **Screenshot** — capture every meaningful state (pass or fail).
6. **Record** — append to the running report with dimensional scores.
7. **Log issues** — if FAIL or PARTIAL, append to `.agent/test_ledger/OPEN_ISSUES.md`.

### 4.2 Browser Subagent Usage Rules
When calling `browser_subagent`:
- Provide the target name and the exact scenario as task context.
- Specify the exact PASS condition.
- Ask for console error reporting.
- Request a screenshot at the end.
- Set generous timeouts for AI generation routines (2+ minutes).
- Split a rich module into 5–8-step batches — do not cram the whole module into one call.

### 4.3 Verdict Definitions
| Verdict | When to Use |
|---------|-------------|
| ✅ PASS | PASS condition fully met. No errors, no deviations. |
| ⚠️ PARTIAL | Works but with degradation (slow, console warning, visual glitch). |
| ❌ FAIL | PASS condition NOT met, OR blocking console error. |
| ❌ FAIL [REGRESSION] | Routine maps to a previously `✅ FIXED` issue that has returned. File with `Severity: 🔴 HIGH`. |
| 🔵 OPEN | Already-open issue. Document current state. |
| 🚫 BUDGET_HOLD | Stopped due to API costs exceeding budget. |

---

## 5. MODULE NAVIGATION GUIDE

Sidebar is grouped: **Projects** (top), **Manager's Office**, **Departments**, **Tools**. Expand a collapsed section to reach its items.
- Boardroom: top-level "Boardroom HQ"
- HQ Dashboard / Projects: top-level "Projects"
- Managers: Manager's Office > "Brand Manager" / "Road Manager" / "Campaign Manager" / "Booking Agent" / "Publicist" / "Creative Director"
- Departments: Departments > "Marketing" / "Social Media" / "Legal" / "Publishing" / "Finance" / "Distribution" / "Licensing" / "Art & Merch" / "Registration Center" / "Security Agent"
- Tools: Tools > "Workflow Builder" / "Audio Analyzer" / "Knowledge Base" / "Memory Agent" / "Command Center" / "Settings"

---

## 6. THE 11 DIMENSIONS

You evaluate the target across these 11 lenses.

### Dimension 1: Performance Profiling
Page/module load time (start → interactive); memory via DevTools; re-measure after 5 min (leaks); layout shifts; AI response timing.
*Budgets: Load < 3s, Module switch < 500ms, AI First Token < 5s, No CLS.*

### Dimension 2: Accessibility Audit
axe-core scan; tab-order + focus ring; alt text; accessible names on buttons; contrast (4.5:1).
*Severity: Missing alt text = HIGH, Contrast = MEDIUM.*

### Dimension 3: Security Surface Testing
Exposed keys in network (`sk_`, `ghp_`, `AIza`); auth tokens not in URLs; protected routes unauthenticated; CSP headers.
*Red Flag: API key exposed = ❌ FAIL.*

### Dimension 4: Architecture Validation (Flowchart-Driven)
Verify the live module matches `docs/flowcharts/` (app layers, state management, the target's own pipeline).

### Dimension 5: State Management Integrity
Zustand state persists across navigation away and back; no subscription leaks; slice isolation (actions in this module don't re-render unrelated ones).

### Dimension 6: AI/Agent Integrity
Banned models NOT used (`gemini-1.5*`, `gemini-2.0*`, `gemini-pro*`); approved models used (`gemini-3*`, `veo-3.1*`); Conductor delegates correctly for this module's agent.

### Dimension 7: Cross-Module Data Flow
Verify the target's outputs reach every module the registry lists as connected. An asset created here but unusable downstream is a FAIL.

### Dimension 8: Responsive & PWA
Viewports 1920 / 1280 / 768 / 375; no horizontal scrollbars; touch targets ≥ 44×44px; manifest + service worker.

### Dimension 9: Production Parity
`VITE_SKIP_ONBOARDING` off in prod logic; App Check token requirements; no dev-only shortcuts leaking.

### Dimension 10: Console Intelligence
🔴 CRITICAL (Unhandled Rejection, TypeError) → HIGH; 🟡 WARNING (React key, deprecated) → MEDIUM. Catch React 18 "Cannot update component while rendering", "unique key", "suspense boundary".

### Dimension 11: Asset Generation Gauntlet
Every endpoint in this module that CREATES a real artifact MUST be tested end-to-end: TRIGGER → WAIT → VERIFY (real, correct MIME, visible, playable/downloadable) → USE DOWNSTREAM.
*Cost Awareness: respect API budgets; use `check_budget_status()`.*

### Dimension 12: Information Continuity (Cross-Pollination)
The deep extension of Dimension 7. Dim 7 asks "does an *asset* reach the next module?" Dim 12 asks "does a *fact* the user gave us actually change what the agents do, everywhere and over time?"

For the target module, verify that:
1. **Inbound:** facts/preferences captured elsewhere (onboarding, settings, prior chat) are present and correct when this module's agent acts. (Memory layer: [UserMemory.ts](packages/renderer/src/types/UserMemory.ts) `preference`/`fact`, `UserContext.topPreferences`/`keyFacts`.)
2. **Applied, not just stored:** the agent's *output* visibly reflects the fact — not merely that the fact is retrievable. ("Puke green" stored ≠ pass. A puke-green design = pass.)
3. **Consistent across agents:** the same fact yields consistent behavior in every consuming module the registry lists.
4. **Superseded correctly:** when the user later changes the fact, the new value wins and the old one stops influencing output (UserMemory `supersededBy`).

*This dimension is exercised most directly by the `continuity` category targets (§12).*

---

## 7. TEST REPORT FORMAT

Maintain a running report, finalize as `artifacts/mega_<target>_<date>_results.md`.

```markdown
# Mega Stress Test — <Target Name> Execution Report

**Date:** <ISO date>
**Target:** <target name> (category: manager|department|tool|project)
**Registry key:** <key>
**Connected modules tested:** <list>

## Scoped Runner Results
- Unit/Integration: <X pass / Y fail>
- E2E: <X pass / Y fail>
- Connections: <X pass / Y fail>

## Dimensional Health Matrix
| Dimension | Score | Critical | Warning | Pass | Notes |
|-----------|-------|----------|---------|------|-------|
| Performance | 🟢 8/10 | 0 | 2 | 8 | ... |
| [All 11 Dimensions] | ... | ... | ... | ... | ... |
| **OVERALL** | **🟡 .../110** | ... | ... | ... | **Target: 100/110** |

## Asset Generation Scorecard
| Endpoint | Status | Time | Downstream |
|----------|--------|------|------------|
| ... | ... | ... | ... |

## Per-Scenario Entries
### Scenario: <Title>
- **Verdict:** ✅ PASS
- **Duration:** ~<seconds>s
- **Observed:** <what happened>
- **New issue filed:** ISSUE-NNN

## New Issues Filed
- ISSUE-NNN: <title> (<severity>)
```

---

## 8. ISSUE FILING FORMAT (.agent/test_ledger/OPEN_ISSUES.md)

Append only. DO NOT edit existing entries.

```markdown
### ISSUE-<NNN>: <Short title>
- **Status:** OPEN
- **Severity:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
- **Dimension:** Performance | Accessibility | Security | Architecture | State | AI | DataFlow | Responsive | ProdParity | Console | AssetGen
- **Target:** <menu item name> (category)
- **Module:** <module name>
- **Flowchart:** <flowchart file> | N/A
- **Tech Stack:** React 18.3.1 | Zustand | Vite 6.4.2 | Firebase | N/A
- **Found:** <YYYY-MM-DD> by /mega-test <target>
- **Summary:** <description>
- **Steps to Reproduce:** ...
- **Expected:** ...
- **UX Impact:** ...
- **Dimensional Data:** <Metrics from failing dimensions>
```

---

## 9. DEPTH-PACKS (`--deep <version>`)

The numbered V1–V12 plans in `.agent/test_ledger/MEGA_STRESS_TEST_V*.md` are **reusable depth-packs**, no longer the unit of work. By default `/mega-test <target>` runs the standard gauntlet. When a single item needs heavier abuse, attach a pack whose routines touch that item:

```
/mega-test road-manager --deep v5     → Pull Road-Manager-relevant routines from the V5 plan
/mega-test audio-analyzer --deep v11   → Pull audio routines from V11
```

When `--deep` is given: read the named plan, extract ONLY the routines that exercise the target module (or its connections), and run them as additional scenarios in the same report. Ignore routines for other modules.

---

## 10. QUICK REFERENCE

```
/mega-test <item>            → Full 12-dimension gauntlet against one menu item
/mega-test <category>        → Sweep every item in a category (managers|departments|tools|projects)
/mega-test                   → List the registry, ask which item to run
/mega-test <item> --deep vN  → Attach numbered depth-pack routines for that item
/mega-test <item> --no-browser → Scoped runner only

Source of truth:
  .agent/test_ledger/departments_test_config.json  ← target taxonomy + scoped surfaces
  execution/run_department_test.py                  ← scoped runner

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Append new issues HERE
  artifacts/mega_<target>_<date>_results.md  ← Session test report
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Append one-line summary
```

---

## 11. ANTI-PATTERNS (DO NOT DO THESE)

| Anti-Pattern | Why It's Wrong |
|-------------|---------------|
| Asking "which version?" | The unit is a menu item, not a version. Resolve the target against the registry. |
| Inventing a target not in the registry | If it's not in `departments_test_config.json`, list valid targets and ask. |
| Testing the module but skipping its connections | The registry lists connected modules. Cross-module data flow is part of the gauntlet. |
| Running the browser gauntlet but skipping the scoped runner | Both halves are required — unit/E2E failures are findings too. |
| Filing vague issues | Every issue needs exact steps + Dimension + Target tags. |
| Marking PARTIAL when it's clearly FAIL | Do not soften failures. |
| Reading source to diagnose | You are the user. Observe and report. |
| Ignoring console errors on PASS | A "working" feature with an Unhandled Promise Rejection is a FAIL. |

---

## 12. CONTINUITY CHAIN TEST DISCIPLINE (the `continuity` category)

> Continuity targets test the backend **cross-pollination of information** — the thing the user cares about most: a fact captured anywhere must change what the agents *do*, everywhere, and over time. This is still black-box: you set a fact as a user, then observe whether downstream agent *output* reflects it. You never read source.

Each continuity target runs as a **4-stage chain**. A stage that "stores but doesn't apply" is a FAIL, not a PARTIAL.

### Stage 1 — CAPTURE
Enter the fact at its natural capture point as a real user would:
- `chain-aesthetic`: in Onboarding (or Settings/Brand Manager), set the artist's favorite color / aesthetic (e.g. "puke green"). Screenshot the saved value.
- `chain-longitudinal-finance`: seed spend history. Real-time accrual isn't testable live, so use the fixture seed (see Stage 0 below) to represent 3 years of recurring guitar-string purchases.
- `chain-identity`: in Onboarding/Profile, set identity facts (genre, hometown, pronouns, band members, mission statement).

### Stage 2 — PERSIST & RETRIEVE
Verify the fact reached the memory/profile layer:
- Open **Memory Agent** (Tools) and confirm the fact appears as a `UserMemory` (`preference`/`fact`) with sensible tags, and/or in `UserContext.topPreferences`/`keyFacts`.
- If it is NOT retrievable here, the chain breaks at storage → file a 🔴 HIGH issue, Dimension: `Continuity`, and stop the chain.

### Stage 3 — APPLY (the real test)
Go to each **consuming module** listed in the target's `connectedDepartments` and trigger an action that *should* use the fact. Observe the OUTPUT:
- `chain-aesthetic`: in Creative Director, generate cover art / a design with a neutral prompt ("make me a poster"). The result must visibly reflect puke green as the aesthetic — without you re-stating the color. Repeat in Brand Manager and Art & Merch.
- `chain-longitudinal-finance`: in Finance (and Boardroom/Marketing), ask for insights. The agent should surface the aggregated guitar-string spend and a reasoned suggestion (e.g. seek a string sponsor).
- `chain-identity`: ask Brand, Creative, Marketing, Publicist, and Legal agents something that depends on identity. Every agent must answer consistently with the captured facts (no agent thinks the band is a different genre).

**PASS = the fact changed the output. Retrievability alone is not a pass.**

### Stage 4 — SUPERSEDE
Change the fact at the capture point (e.g. favorite color → matte black). Re-run one Stage-3 action per consuming module. The new value must win and the old value must stop influencing output (`UserMemory.supersededBy`). Stale influence = 🟡 MEDIUM issue minimum.

### Stage 0 — Fixture seeding (longitudinal chains only)
Longitudinal chains need historical data that can't be produced live. Before Stage 1, ask the user whether a seed fixture exists; if so, load it via the documented seed path. Never fabricate displayed numbers — if no seed exists, mark the chain `⏭️ BLOCKED (needs fixture)` and file a note rather than faking a 3-year history. (Honors the no-mock-data rule.)

### Continuity issue tagging
File continuity findings with `Dimension: Continuity`, name the **broken stage** (Capture / Persist / Apply / Supersede), the **source fact**, and the **consuming module(s)** where it failed to surface. Example summary: *"Aesthetic chain breaks at APPLY: favorite color 'puke green' persists in Memory Agent but Creative cover-art generation ignores it (output is default blue)."*
