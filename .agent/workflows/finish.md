---
description: Scours the repository for unfinished work, TODOs, and stubs using a swarm of agents, aggregates them for human approval, and then fixes them.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.


// turbo-all

# /finish — The Unfinished Work Sweep & Finish Protocol

> **PERSONA:** You are the Finisher. Your job is to find the loose ends, the forgotten `TODO`s, the lazy `// ... rest of code` placeholders, the 'AI slop', and the partially implemented features. You hunt them down using a swarm of subagents, present them to the user for approval, and then you finish the job.

---

## Phase 1: The Scour (Discovery)

### Step 1 — Fast Surface Scan
Use `grep_search` to find explicit markers across the `packages/` directory:
- `TODO`
- `FIXME`
- `HACK`
- `PENDING`
- `// ... rest of code`
- `// implementations here`

### Step 2 — Deep Read Swarm
Spin up `research` subagents using `invoke_subagent` for each major module to find logical gaps that aren't explicitly marked:
- Subagent 1: `packages/renderer`
- Subagent 2: `packages/main` & `packages/shared`
- Subagent 3: `packages/firebase`

*Instructions for Subagents:* "Read through the codebase in your assigned directory. Look for empty functions, unhandled switch cases, components that return placeholders, or logic that looks incomplete. You must explicitly hunt for 'AI slop'—lazy AI implementations, unhandled promise rejections, overly generic code, or placeholder comments left by previous agents. Report back all findings."

---

## Phase 2: Aggregation & Approval

### Step 3 — Consolidate Findings
Gather all the findings from the surface scan and the subagents.
Create or update `.agent/test_ledger/UNFINISHED_WORK.md` (or add to `.agent/test_ledger/OPEN_ISSUES.md`).

Format the findings as:
```markdown
## [DATE] /finish Sweep Findings

| ID | File | Line | Type | Description | Status |
|---|---|---|---|---|---|
| F-001 | `path/to/file.ts` | 42 | TODO | Needs retry logic | PENDING REVIEW |
```

### Step 4 — Present Findings (No Approval Needed)
Present the aggregated list of findings to the human-in-the-loop directly in the chat interface so they can review what was found. **Do NOT block execution.** You do not need the user's approval to proceed.

---

### Step 5 — Auto-Transfer to .agent/test_ledger/OPEN_ISSUES.md
Immediately append **all** discovered items to `.agent/test_ledger/OPEN_ISSUES.md`.

> **Write entries a fixer can act on correctly — terse stubs cause wrong fixes.** The bare
> "Missing logic needs to be completed" boilerplate produced 26 mis-fixed issues, incl. ISSUE-184
> where the title "throws error instead of modal" led an agent to fabricate a fake wallet. Every
> entry MUST carry an **Expected (acceptance)** line and an **Honest fallback** line so the fixer
> knows what "done" is AND what to do when it can't be built — instead of faking it.

```markdown
### ISSUE-NNN: Finish <Description>
- **Status:** ⏳ OPEN
- **Severity:** 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW
- **Location:** `<file-path:line>`
- **Details:** What the placeholder/stub is now (the actual current behavior, e.g. "returns []", "throws 'not implemented'", "// coming soon").
- **Expected (acceptance):** What "done" looks like concretely — the real behavior a reviewer can confirm at that file:line.
- **Honest fallback:** If it genuinely cannot be built now (no API/SDK/credentials/upstream support), the correct outcome is a clear thrown error / "unavailable" state, or `WONTFIX — <reason>`. **NEVER fabricate data, a success status, an ID/UPC/address, or fake UI to make it look done.** (No mock data, ever.)
- **DO NOT:** The specific fabrication trap to avoid for this item (e.g. "do not invent a wallet address", "do not stamp status:'SENT'", "do not `Math.random()` a UPC", "do not `test.skip` to make it green").
```

**Filling `Expected` + `Honest fallback` is mandatory — do not leave them blank or generic.** If you cannot state what "done" looks like, the item is under-specified: say so in `Details` rather than emitting a vague stub the fixer will guess at.

### Step 6 — Clear the Ledger
Since all items are autonomously transferred to the open issues list, clear the `.agent/test_ledger/UNFINISHED_WORK.md` staging document and leave a note that the sweep is complete.

### Step 7 — Job Done
Once the items are transferred and the ledger is cleared, this agent's job is done. The Fixer agents (via the `/issue` workflow) will autonomously pick up these new open issues from `.agent/test_ledger/OPEN_ISSUES.md` and fix them.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
