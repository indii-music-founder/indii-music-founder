---
description: Session bootstrap — comprehensive environment audit, handoff state check, and Operator persona activation. Run this at the START of every session.
---

# /opp - Operator Persona Activation (Enhanced)

**Use at the START of a session to get complete situational awareness and activate the Operator.**

## 1. Environment Scan (// turbo - Execute All in Parallel)

Check core infrastructure:

- `git status` + `git branch` — Repo state and current branch
- `git log -n 5 --oneline` — Recent commits
- `ls -la .agent/` — Agent system files
- `ls -la .agent/skills/` — Skill inventory
- `ls -la .agent/workflows/` — Workflow inventory
- `ls node_modules 2>/dev/null | wc -l` — Node modules installed? (count)

## 2. Handoff State Check (// turbo)

Check for prior session work:

- Read `.agent/HANDOFF_STATE.md` (if exists) — What was built, what's pending
- Read `.agent/artifacts/task.md` (if exists) — Active task list
- Read `.agent/artifacts/implementation_plan.md` (if exists) — Active plan
- Check for any uncommitted changes via `git status`

## 3. Preventative Maintenance Medicine (// turbo)

Inject pattern awareness:

- Read `.agent/skills/error_memory/ERROR_LEDGER.md` — Watch for:
  - Duplicate identifiers from mass squashes
  - Missing `vi.mock` for dynamic imports or Electron modules
  - A11y test assertions drifting from component source
  - Missing `.catch()` on async ops causing silent canvas/component failures
  - Agent routing typos in prompts

## 4. Memory System Check (// turbo)

Verify user memory is accessible:

- Check if memory directory exists: `/Volumes/X SSD 2025/Users/narrowchannel/.claude/projects/-Volumes-X-SSD-2025-Users-narrowchannel-Desktop-indii-music-founder/memory/`
- Read `MEMORY.md` to see what's being tracked
- Count memory files to gauge prior session depth

## 5. Comprehensive Operator Status Output

**Output a SINGLE block with this structure:**

```text
=== OPERATOR STATUS ===

WORKSPACE:
  Project:      indii-music-founder
  Branch:       [current branch]
  Location:     /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder

GIT STATE:
  Status:       [clean/dirty/conflicts]
  Commits:      [latest 3 one-liners]
  Uncommitted:  [count or "none"]

INFRASTRUCTURE:
  Node Modules: [count or "missing"]
  .agent/:      [✓ present]
  Skills:       [count available]
  Workflows:    [count available]

HANDOFF STATE:
  Prior Session: [date or "none"]
  Work Built:    [summary or "none"]
  Pending:       [summary or "none"]
  Active Task:   [summary or "none"]
  Active Plan:   [exists/missing]

ERROR LEDGER:
  Recent Patterns: [top 3 to watch or "none"]

MEMORY:
  Tracked Files: [count]
  Key Memories:  [list 2-3 relevant topics]

NEXT STEPS:
  Recommended:   [based on state — e.g., "resume prior task", "start fresh", "run /go"]
```

## 6. Handoff & Routing

1. **Display the Operator Status** (above).
2. **Wait for user directive**.
3. **Route based on input:**
   - `/skill-name` → Execute that skill
   - `/workflow-name` → Execute that workflow
   - Task description → Enter PLANNING mode
   - No input → Wait for directive

---

## Quick Cheat: What `/opp` Tells You

| Signal | Meaning | Next Step |
| --- | --- | --- |
| "Branch: feat/X" + "Pending: [task list]" | Mid-sprint work resumed | `/go` to continue |
| "Status: dirty" + "Uncommitted: 5 files" | Unsaved changes from prior session | Review diff, commit or discard |
| "Node Modules: missing" | Fresh machine, need bootstrap | Run `npm install` before work |
| "Active Task: none" + "Plan: missing" | Fresh start | Describe what you want built |
| "Error Ledger: [patterns]" | Known issues in flight | Watch for these in `/go` |
