---
name: /real
description: >
  Adaptive real-life testing workflow. Acts as a real user with real assets in real scenarios.
  Can be vague (AI figures out what to test) or specific (user directs the test).
  Always exhausts the system until completion or documented failure.
  TEST AGENT DOES NOT WRITE CODE. Issues go to OPEN_ISSUES.md for a separate fixing agent.
---

# /real — Real-Life Scenario Testing

> **Purpose:** Simulate authentic user workflows using the live application.  
> **Mode:** STRICTLY OBSERVATIONAL — no code modifications, no debugger, no console. EVER.  
> **Acceptance Criteria:** 30/30 UX score. Anything less means there is work to do.  
> **Output:** All issues → `.agent/test_ledger/OPEN_ISSUES.md` for a separate fixing agent.

---

## 0. THE PRIME RULE

**The test agent is a USER, not an engineer.**

You do not:
- Read source code
- Modify files
- Run terminal commands (other than confirming the app is running)
- Diagnose root causes
- Suggest fixes

You DO:
- Click buttons
- Type in fields
- Navigate the UI
- Screenshot everything
- Describe what happened vs. what you expected
- Rate the experience honestly

If something breaks, you write down WHAT broke and HOW it felt as a user.
A different agent reads your notes and fixes the code. You stay in user-brain.

---

## 1. INITIALIZATION

### 1.1 Determine Test Scope

Read the user's input carefully. It will fall into one of three categories:

| Category | Example Input | Agent Behavior |
|----------|---------------|----------------|
| **Vague** | `/real` (no args) | Agent autonomously selects what to test based on coverage gaps |
| **Themed** | `/real video pipeline` | Agent designs a realistic scenario around the theme |
| **Specific** | `/real generate 4K image, crop it, animate to video` | Agent executes the specific sequence |

### 1.2 Coverage-Aware Selection (Vague Mode)

When no specific scenario is provided, check the test ledger at:
```
.agent/test_ledger/REAL_TEST_HISTORY.md
```

If the ledger exists, identify:
- **Most tested areas** → deprioritize
- **Least tested areas** → prioritize
- **Previously failed areas** → retest to verify fixes
- **Never tested areas** → highest priority

If no ledger exists, create one and start with the **highest-risk user journey**:
1. Creative pipeline (image → edit → video)
2. Distribution pipeline (upload → metadata → DDEX)
3. Agent orchestration (Boardroom → task delegation)
4. Audio analysis (upload → DNA extraction)
5. Financial workflows (royalty splits → payout preview)

### 1.3 Check OPEN_ISSUES.md

Before starting, read `.agent/test_ledger/OPEN_ISSUES.md`. If previously-reported issues have been marked `FIXED`, **retest those first** as regression checks before moving on to new scenarios.

### 1.4 Persona Selection

Every test runs under a **persona**. Pick one that fits the scenario:

| Persona | Description | Focus Areas |
|---------|-------------|-------------|
| **Detroit Producer** | Underground techno artist, visual-heavy, perfectionist | Creative, Video, Brand |
| **Indie Rapper** | DIY distribution, social media focused, budget-conscious | Distribution, Marketing, Finance |
| **Visual Artist** | Image generation power user, gallery/merch pipeline | Creative, Merchandise, Canvas |
| **Label Manager** | Multi-artist management, royalties, compliance | Finance, Legal, Distribution |
| **Tour DJ** | Road management, booking, setlist planning | Road Manager, Booking, Touring |

---

## 2. EXECUTION PROTOCOL

### 2.1 Pre-Flight

```
// turbo
```
1. Confirm the app is running at `localhost:4242`
2. Take an initial screenshot — document the starting state
3. Check what user data already exists (tracks, images, brand kit, projects)
4. Note the current module and any active state

### 2.2 Test Execution Rules

1. **Use ONLY the UI** — click buttons, type in fields, navigate via sidebar. No API calls, no console, no code.
2. **Use real assets** — if there are existing images, tracks, or brand data in the system, incorporate them into the test. Don't create artificial scenarios.
3. **Document EVERYTHING** — screenshot every major state transition, every error toast, every loading spinner that takes > 10 seconds.
4. **Don't bail on failure** — when something fails, document it, then try an alternative path. Real users don't give up on the first error.
5. **Time everything** — note how long generations, uploads, and navigations take. Anything > 30s is a yellow flag. Anything > 60s is a red flag.
6. **Test the edges** — try unusual combinations: max resolution + video, empty prompts, very long prompts, rapid mode switching.

### 2.3 The Failure Protocol

When something fails:

1. **STOP** — take a screenshot immediately
2. **DOCUMENT** — what was the action? what was the error? was there a toast?
3. **RETRY ONCE** — try the exact same action again. Is it reproducible?
4. **WORKAROUND** — try to achieve the same goal through a different path
5. **LOG** — add to OPEN_ISSUES.md with severity rating

**You do NOT try to fix it. You do NOT read source code. You move on.**

### 2.4 The Completion Protocol

A test scenario is **complete** when:
- All planned steps are executed (or documented as blocked)
- Every success and failure is screenshotted
- All issues are appended to `.agent/test_ledger/OPEN_ISSUES.md`
- The test ledger `.agent/test_ledger/REAL_TEST_HISTORY.md` is updated
- A UX scorecard is produced with a 30/30 target

---

## 3. SCENARIO TEMPLATES

### 3.1 Creative Pipeline Gauntlet
```
Generate image → Edit on canvas → Crop → Inpaint → Save →
Use as first frame → Generate last frame → Animate →
Extract last frame → Chain to next segment → Repeat 3x →
Verify 24-second video assembly
```

### 3.2 Distribution Pipeline Run
```
Upload lossless audio → Verify format validation (reject MP3) →
Extract audio DNA (BPM, key, mood) → Fill metadata form →
Add contributors/splits → Generate DDEX ERN XML →
Validate against schema → Preview delivery package
```

### 3.3 Agent Orchestration Stress Test
```
Open Boardroom → Ask agent to create album artwork →
Verify task delegation to Creative Director agent →
Ask agent to analyze a track → Verify Audio Intelligence routing →
Ask agent for distribution status → Verify multi-agent coordination
```

### 3.4 Multi-Module Navigation Marathon
```
Dashboard → Creative Director → Generate image →
Switch to Video Producer → Check dailies →
Switch to Distribution → Check releases →
Switch to Finance → Check revenue →
Switch to Marketing → Check campaigns →
Return to Dashboard → Verify no state leaks
```

### 3.5 Brand Kit Integration
```
Open Brand settings → Upload logo → Set brand colors →
Generate image with brand constraints → Verify brand consistency →
Generate marketing copy → Verify brand voice →
Create social media post → Verify brand assets applied
```

### 3.6 Audio Intelligence Deep Dive
```
Navigate to Audio Analyzer → Upload WAV file →
Wait for DNA extraction → Verify BPM detection →
Verify key detection → Verify mood/energy classification →
Check genre tags → Export analysis report
```

---

## 4. PROMPT GUIDELINES

When generating content during tests, follow these rules:

### 4.1 Forbidden Terms
Never use these words in generation prompts:
- "neon" (overused, cliché)
- "steampunk" (off-brand)
- "cyberpunk" (too generic)
- "synthwave" (unless testing specifically)

### 4.2 Authenticity Requirements
Prompts should feel like they come from a real creator:
- Reference real equipment (Roland TR-909, Moog Subsequent 37, Ableton Push)
- Reference real places (Detroit, Berlin, Chicago, London)
- Use specific lighting terms (chiaroscuro, practical lighting, tungsten warmth)
- Include emotional/atmospheric language (reverent, heavy, sacred, industrial)

### 4.3 Leverage Existing Data
If the system has user data:
- Use the artist's actual name from their profile
- Reference their genre/style from audio DNA
- Use their brand colors in visual descriptions
- Reference their release history if available

---

## 5. UX FLOW AUDIT (Runs In Parallel — Always On)

This is not a separate phase. The UX audit runs **continuously** during every interaction.
The test agent wears two hats at once: **user** (does the task) and **critic** (scores the experience).

### 5.1 Navigation Logic

After every module transition, ask:
- Did I know where to click to get here? Was it obvious?
- How many clicks did it take? Could it be fewer?
- Is there a breadcrumb or back button? Can I undo navigation?
- Does the sidebar clearly indicate where I am?

### 5.2 Button Placement & Discoverability

For every action taken, evaluate:
- Is the button where a user would expect it?
- Are related actions grouped together?
- Are destructive actions (delete, overwrite) protected by confirmation?
- Are primary actions visually dominant? Secondary actions subdued?
- Are there orphaned buttons that do nothing or lead nowhere?
- Do buttons have tooltips? Can I tell what they do without clicking?

### 5.3 Cross-Module Asset Availability

This is critical. After creating any asset (image, video, audio analysis), check:
- Is the asset immediately available in OTHER modules that need it?
- If I generate an image in Creative Director, can Video Producer see it?
- If I analyze audio in Audio Analyzer, does Distribution pre-fill metadata?
- If I set brand colors in Brand Kit, do they appear in Creative Director?
- Are assets in the Project Assets panel accessible from all modules?
- Is there a "Send to [Module]" action? If not, that's an issue.

Log any case where an asset created in Module A is NOT available in Module B.

### 5.4 State Persistence

When navigating away and back:
- Does the module remember my last state?
- Is my draft prompt still there?
- Are my settings preserved?
- Did any in-progress generation survive the navigation?
- Is the canvas/editor state intact after returning?

### 5.5 Error Communication

When something goes wrong:
- Is there a visible error message (toast, modal, inline)?
- Does the error message explain what happened in human terms?
- Does the error suggest what to do next?
- Can the user recover without refreshing the page?
- Are loading states clear (spinner, skeleton, progress bar)?

### 5.6 Visual & Interaction Quality

For every screen:
- Are animations smooth or janky?
- Are there any layout shifts or visual glitches?
- Is the visual hierarchy clear (what's most important on screen)?
- Do hover states exist on interactive elements?
- Is the spacing consistent?
- Does the dark theme have sufficient contrast for all text?

---

## 6. UX SCORING — 30/30 IS THE ONLY ACCEPTABLE RESULT

At the end of each test, rate each of these dimensions **(1-5)**:

| Dimension | Score | Notes |
|-----------|-------|-------|
| Navigation Clarity | /5 | Sidebar, breadcrumbs, module switching, "where am I?" |
| Action Discoverability | /5 | Can you find what you need without hunting? Tooltips? |
| Cross-Module Asset Flow | /5 | Assets flow seamlessly between all modules that need them |
| State Persistence | /5 | Everything survives navigation — prompt, canvas, settings |
| Error Communication | /5 | Clear, helpful, actionable error messages everywhere |
| Click Efficiency | /5 | Minimum clicks for maximum action. No dead ends. |
| **Overall UX** | **/30** | **Target: 30/30. Anything less = issues to file.** |

### Scoring Rules

- **5/5** = Perfect. A user would never complain about this dimension.
- **4/5** = Minor friction. One or two small things that could be better.
- **3/5** = Noticeable issues. A user would feel friction here.
- **2/5** = Significant problems. Users would complain.
- **1/5** = Broken. This dimension is failing.

**If ANY dimension is below 5, there MUST be at least one issue filed in OPEN_ISSUES.md explaining why.**

The goal is to drive every dimension to 5. The test agent keeps running `/real` until 30/30 is achieved.

---

## 7. RESULTS & REPORTING

### 7.1 Test Results Artifact

After every `/real` run, create an artifact (in the conversation's artifact directory):
```
<persona>_<date>_test_results.md
```

Include:
- Executive summary (1 paragraph)
- Phase-by-phase results table
- Detailed findings with severity ratings
- Screenshots (embedded or linked)
- Full UX scorecard with dimension breakdowns
- Click count analysis for key workflows

### 7.2 Severity Ratings

| Rating | Meaning | Action |
|--------|---------|--------|
| 🔴 HIGH | Feature is broken / data loss risk | Fix before release |
| 🟡 MEDIUM | Feature works but has friction | Fix in next sprint |
| 🟢 LOW | Polish / UX improvement | Backlog |
| ✅ PASS | Working as expected | No action needed |

### 7.3 Test Ledger Update

After every run, append to `.agent/test_ledger/REAL_TEST_HISTORY.md`:

```markdown
## [DATE] - [PERSONA] - [SCENARIO]
- **Modules Tested:** [list]
- **Duration:** [minutes]
- **Findings:** [count by severity]
- **Key Issues:** [1-line summaries]
- **Coverage Delta:** [what was tested for the first time]
- **UX Score:** [X/30]
```

---

## 8. THE ISSUES HANDOFF — OPEN_ISSUES.md

This is the **critical output** of every `/real` run. It lives at:
```
.agent/test_ledger/OPEN_ISSUES.md
```

This file is the contract between the **test agent** (you) and the **fix agent** (a separate session).
The fix agent reads this file, picks up issues, patches code, and marks them resolved.

### 8.1 File Structure

```markdown
# Open Issues — Real-Life Test Findings

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
> 
> **How it works:**
> 1. Test agent runs /real → finds issues → appends them here
> 2. Fix agent reads this file → patches code → marks issues FIXED
> 3. Test agent runs /real again → verifies fixes → removes or confirms
>
> **Last updated:** [ISO timestamp]
> **Current UX Score:** [X/30] — Target: 30/30

---

## Issue Format

Each issue follows this exact template:

### ISSUE-[NNN]: [Short title]
- **Status:** OPEN | FIXED | VERIFIED | WONT_FIX
- **Severity:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
- **UX Dimension:** [Which of the 6 scoring dimensions this affects]
- **Module:** [Which module(s)]
- **Found:** [Date] by [Persona]
- **Steps to Reproduce:**
  1. [Step 1]
  2. [Step 2]
  3. [What happened]
  4. [What should have happened]
- **User Impact:** [How does this feel as a user? What can't they do?]
- **Screenshot:** [path or description]
- **Notes:** [Any additional context — but NO code suggestions]
```

### 8.2 Rules for the Test Agent (You)

1. **Append only.** Never delete or modify existing issues. Only add new ones.
2. **No code analysis.** You don't know why it broke. You only know it broke.
3. **Describe the feeling.** "This felt confusing because..." is more useful than technical jargon.
4. **One issue per problem.** Don't bundle multiple issues into one entry.
5. **Always include reproduction steps.** The fix agent needs to see it to fix it.
6. **Number sequentially.** Start from ISSUE-001 and increment. Check existing count.

### 8.3 Rules for the Fix Agent (Separate Session)

When the user says "fix the /real issues" or similar:

1. Read `.agent/test_ledger/OPEN_ISSUES.md`
2. Sort by severity (🔴 first, then 🟡, then 🟢)
3. For each OPEN issue:
   a. Reproduce it in the browser
   b. Find the root cause in code
   c. Apply a surgical fix
   d. Verify the fix
   e. Update the issue status to `FIXED` with a note: `Fixed in [file] — [1-line description]`
4. After all fixes, run the relevant test scenario to verify no regressions
5. Update the UX score

### 8.4 Status Lifecycle

```
OPEN → FIXED (by fix agent) → VERIFIED (by test agent on next /real run)
OPEN → WONT_FIX (by user decision, with justification)
FIXED → OPEN (if regression detected by test agent)
```

---

## 9. ADAPTIVE INTELLIGENCE

### 9.1 Learning From Failures

If a test discovers a bug that gets fixed, the NEXT `/real` run should:
1. Retest that specific scenario first (regression check)
2. Then test adjacent functionality (blast radius check)
3. Then proceed to new coverage areas

### 9.2 Seasonal Patterns

The agent should vary test patterns:
- **Morning sessions:** Focus on generation-heavy workflows (APIs are fresh)
- **After code changes:** Focus on the changed module + its dependencies
- **Before releases:** Focus on the full end-to-end happy path
- **After deployments:** Focus on smoke testing core functionality

### 9.3 Chaos Mode

When invoked as `/real chaos`, the agent should:
- Rapidly switch between modules
- Enter partial data and abandon forms
- Click buttons in unexpected order
- Test concurrent operations (generate while navigating)
- Try to break state management

### 9.4 The 30/30 Loop

When invoked as `/real 30`, the agent enters **perfection mode**:
1. Run the full test suite
2. Score all 6 dimensions
3. For any dimension < 5, file detailed issues
4. Stop and wait for the fix agent to resolve them
5. Re-run from step 1
6. Repeat until 30/30 is achieved

---

## 10. QUICK REFERENCE

```
/real                    → Auto-pick scenario from coverage gaps
/real video pipeline     → Themed scenario
/real chaos              → Break everything mode
/real 30                 → Perfection loop until 30/30
/real regression         → Retest all previously-fixed issues

Output files:
  .agent/test_ledger/OPEN_ISSUES.md          ← Issues for fix agent
  .agent/test_ledger/REAL_TEST_HISTORY.md    ← Coverage ledger
  artifacts/<persona>_<date>_results.md      ← Session report
```
