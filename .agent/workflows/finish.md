---
description: Scours the repository for unfinished work, TODOs, and stubs using a swarm of agents, aggregates them for human approval, and then fixes them.
---

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
Create or update `.agent/test_ledger/UNFINISHED_WORK.md` (or add to `OPEN_ISSUES.md`).

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

### Step 5 — Auto-Transfer to OPEN_ISSUES.md
Immediately append **all** discovered items to `.agent/test_ledger/OPEN_ISSUES.md` following the standard issue protocol format:

```markdown
## ISSUE-NNN: Finish <Description>
- **Status:** OPEN
- **Severity:** Medium
- **Location:** `<file-path>`
- **Details:** Found during `/finish` sweep. Missing logic or AI slop needs to be completed/removed.
```

### Step 6 — Clear the Ledger
Since all items are autonomously transferred to the open issues list, clear the `.agent/test_ledger/UNFINISHED_WORK.md` staging document and leave a note that the sweep is complete.

### Step 7 — Job Done
Once the items are transferred and the ledger is cleared, this agent's job is done. The Fixer agents (via the `/issue` workflow) will autonomously pick up these new open issues from `OPEN_ISSUES.md` and fix them.
