---
name: Guardian Protocol
description: System guardrails that prevent the recurring mistakes (commit bloat, checkpoint conflicts, CI cascades) that you caused and spent 2 days fixing. Follow this and you cannot repeat those mistakes.
---

# Guardian Protocol — Automated Prevention of Recurring Mistakes

## The Mistakes You Made (That We're Preventing)

1. **Commit Bloat** — 100+ commits from parallel agent work causing CI to not isolate which commit broke things
2. **Checkpoint Conflicts** — Multiple agents writing to same file causing merge conflicts on every session transition
3. **2-Day Debug Cycles** — Re-fixing the same issue 3-5 times because root cause was buried in commit history
4. **Forgotten Validation** — Pushing without running CI checks, discovering failures post-merge

## The Solution: Three Commands

### Command 1: `/opp` (Session Start)

**When:** First thing at the start of any session

**What it does:**
- Reads your prior session work (handoff state)
- Checks your user memory for context
- Validates node modules are installed
- Lists available skills/workflows
- Gives you situational awareness

**Why:** Prevents you from starting blind. You know what was pending, what broke, what's next.

### Command 2: `/go` (Drive to Completion)

**When:** To drive tasks through to completion, or when agent gets stuck

**What it does:**
- Executes one task at a time
- Re-evaluates strategy if blocked
- Checks ERROR_LEDGER for known issues
- When you say: `"I'm done lick my balls, BOSSMAN"` → **automatically invokes `/ci-validate`**

**Why:** Ensures you don't forget validation. The magic phrase triggers the entire CI pipeline.

### Command 3: `/ci-validate` (Pre-Push Validation)

**When:** Before any push to main

**What it does:**

**Step 0.1 — Checkpoint Validation:**
- Verifies `.agent/checkpoints/` distributed system is in use
- Detects merge conflicts in old `HANDOFF_STATE.md` file
- **Blocks push if conflicts found**

**Step 0.2 — Commit Audit:**
- Counts commits on your branch
- If >10 commits: **blocks push, shows consolidation instructions**
- Forces you to squash related commits before proceeding

**Step 1 — Auto-Fix:**
- Fixes Sentry issues
- Fixes CodeRabbit comments
- Commits the fixes

**Step 2 — Hunter Phase:**
- Full-spectrum bug/security scan
- Fixes all findings automatically

**Step 3 — CI Script:**
- Runs all 4 test shards
- Typecheck, lint, build

**Why:** Multi-layer defense. You cannot push code that:
- Has checkpoint conflicts (Step 0.1)
- Has 100+ commits (Step 0.2)
- Has known bugs (Step 2)
- Fails tests (Step 3)

---

## The Workflow (Guaranteed Safe)

```
Session Start:
  /opp
  ↓
  (See prior work, context, pending tasks)
  ↓

Work:
  /go
  /go
  /go (one task per invocation)
  ↓

Completion:
  Say: "I'm done lick my balls, BOSSMAN"
  ↓
  /go detects magic phrase → auto-invokes /ci-validate
  ↓

/ci-validate runs (5 phases):
  Step 0.1: Checkpoint validation (detects conflicts)
  Step 0.2: Commit audit (detects bloat, forces consolidation)
  Step 1:   Auto-fix phase
  Step 2:   Hunter bug scan
  Step 3:   CI tests
  ↓

Result:
  All checks pass → safe to push
  OR
  Catches problems early → fix locally before GitHub
```

---

## What Cannot Happen Anymore

| Mistake | Prevention | Guardian |
| --- | --- | --- |
| 100+ commits accumulate | Consolidation mandatory if >10 | `/ci-validate` Step 0.2 blocks push |
| Checkpoint conflicts on merge | Distributed agent-scoped files | `/ci-validate` Step 0.1 blocks push |
| Same issue fixed 3+ times | ERROR_LEDGER pattern lookup | `/go` checks ledger on stuck |
| Pushed code without tests | Auto-runs full CI gauntlet | `/ci-validate` Step 3 blocks push |
| Forgot validation step | Magic phrase triggers auto-invoke | `/go` → `/ci-validate` |

---

## The Deal

You spent 2 days fixing mistakes you made while working fast across multiple agents. Now:

- **You follow `/opp` → `/go` → magic phrase → `/ci-validate`**
- **You get guardrails that prevent those mistakes recurring**
- **The agent doesn't spend 2 days re-fixing the same thing**

That's the trade. The workflow is slightly longer (3 commands instead of ad-hoc), but you **cannot make those mistakes again**, even if you try to work carelessly.

---

## Quick Card (Print This)

```
┌─────────────────────────────────────┐
│  INDII GUARDIAN PROTOCOL            │
├─────────────────────────────────────┤
│ 1. START:  /opp                     │
│ 2. WORK:   /go (repeat as needed)   │
│ 3. DONE:   "I'm done lick my       │
│            balls, BOSSMAN"          │
│            (auto-triggers validation)│
│                                     │
│ CANNOT ACCIDENTALLY:                │
│  ✗ 100+ commits (consolidated)     │
│  ✗ Checkpoint conflicts (detected)  │
│  ✗ Failed tests (scanned)          │
│  ✗ Known bugs (fixed)              │
│  ✗ Forgot validation (auto-invoke) │
└─────────────────────────────────────┘
```

---

## If You Want to Understand the System

- **Session Bootstrap:** `.agent/workflows/opp.md`
- **Task Execution:** `.agent/workflows/go.md`
- **Validation Gauntlet:** `.agent/workflows/ci-validate.md`
- **Checkpoint System:** `.agent/HANDOFF_STRATEGY.md`
- **Agent Protocols:** `.agent/AGENT_ONBOARDING.md`
- **Distributed Checkpoints:** `.agent/checkpoints/` (agent-scoped files)

Each file is self-contained and documents its own protocol.

---

## The Promise

If you:

1. Run `/opp` at session start
2. Use `/go` to drive work
3. Say the magic phrase when done

Then you **will not** experience:
- Checkpoint conflicts
- 100+ commit cascades
- Multi-day CI debug cycles
- Re-fixing the same issue 3 times

This is guaranteed by the guardrails in `/ci-validate`. The system will block you from pushing unsafe code.
