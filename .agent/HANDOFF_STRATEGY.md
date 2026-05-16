---
name: Handoff Strategy
description: Distributed handoff system to prevent merge conflicts when multiple agents checkpoint simultaneously
---

# Distributed Handoff Strategy (Anti-Conflict Protocol)

## Problem

When multiple agents (Claude Code + Antigravity agents) work in parallel, they both try to write to `.agent/HANDOFF_STATE.md` simultaneously, causing merge conflicts that require manual resolution every time.

**Root Cause:** Singleton checkpoint file with no coordination mechanism.

## Solution: Distributed Agent Checkpoints

Instead of one global `HANDOFF_STATE.md`, each agent writes to its own **agent-scoped checkpoint file** in a dedicated directory. Git merges happen at the directory level (no conflicts), and a coordinator can read all checkpoints on session start.

### Directory Structure

```
.agent/
├── checkpoints/
│   ├── claude-code.md          # Claude Code agent checkpoint
│   ├── antigravity-claude.md   # Antigravity Claude agent checkpoint
│   ├── antigravity-gemini.md   # Antigravity Gemini agent checkpoint
│   ├── antigravity-droid.md    # Antigravity DROID agent checkpoint
│   └── _coordinator.md         # Coordinator merges all checkpoints
├── HANDOFF_STATE.md            # DEPRECATED — do not use
└── ...
```

### Protocol: Agent Checkpoint Write

**Each agent uses this pattern when ending a session:**

```bash
# Agent identifies itself (via environment or CLI arg)
AGENT_ID="claude-code"  # or "antigravity-claude", etc.

# Write checkpoint to agent-scoped file (no conflicts possible)
cat > ".agent/checkpoints/${AGENT_ID}.md" << 'EOF'
---
name: Handoff State
agent: ${AGENT_ID}
timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
---

# Work Summary
- **Built:** [what this agent built]
- **Fixed:** [what bugs this agent fixed]
- **Tests:** [test results]

# Pending for Next Agent
- [task 1]
- [task 2]

# Branch State
- **Branch:** $(git branch --show-current)
- **Commits Ahead:** $(git rev-list --count main..HEAD)
- **Uncommitted:** $(git status --short | wc -l)
EOF

# Stage and commit (safe — no other agent touches this file)
git add ".agent/checkpoints/${AGENT_ID}.md"
git commit -m "chore(checkpoint): ${AGENT_ID} session end [$(date +%H:%M)]"
git push origin $(git branch --show-current)
```

### Protocol: Coordinator Read (Session Start)

**On session start, the `/opp` workflow reads ALL checkpoints:**

```bash
# Read all agent checkpoints from the distributed system
cat .agent/checkpoints/*.md | grep -E "^(agent:|Built:|Fixed:|Pending)" | head -50

# Merge summary into session context
echo "=== MULTI-AGENT HANDOFF SUMMARY ==="
echo "Last checkpoints:"
ls -lht .agent/checkpoints/*.md | head -5
```

### Key Properties

| Property | Benefit |
| --- | --- |
| **No file conflicts** | Each agent writes to its own file (claude-code.md, antigravity-gemini.md, etc.) |
| **Parallel safe** | Multiple agents can checkpoint simultaneously without Git merges |
| **History preserved** | Git log shows which agent did what and when |
| **Readable by all** | `/opp` workflow reads all checkpoints on start |
| **Scalable** | Add new agents by creating new checkpoint file (no coordination needed) |

---

## Implementation: Update Checkpoint Scripts

### For Claude Code Sessions

When using the checkpoint hook or `/opp` at session end:

```bash
# Instead of writing to HANDOFF_STATE.md
# Write to: .agent/checkpoints/claude-code.md
git add ".agent/checkpoints/claude-code.md"
git commit -m "chore(checkpoint): claude-code session end"
```

### For Antigravity Sessions

Each Antigravity agent (Claude, Gemini, DROID, JULES, CODEX) checkpoints to:

- `.agent/checkpoints/antigravity-claude.md`
- `.agent/checkpoints/antigravity-gemini.md`
- `.agent/checkpoints/antigravity-droid.md`
- `.agent/checkpoints/antigravity-jules.md`
- `.agent/checkpoints/antigravity-codex.md`

**No conflicts.** Each file is independent.

---

## Migration

1. Create `.agent/checkpoints/` directory
2. Move current `HANDOFF_STATE.md` → `.agent/checkpoints/_legacy.md` (archive)
3. Update checkpoint hooks to write to agent-scoped files
4. Update `/opp` to read from `checkpoints/` directory
5. Commit: `chore: migrate to distributed agent checkpoint system`

---

## Why This Works

**Before:** One file, multiple agents, merge conflicts.

```
Agent A writes: HANDOFF_STATE.md
Agent B writes: HANDOFF_STATE.md
↓
Git conflict marker in HANDOFF_STATE.md
↓
Manual resolution required
```

**After:** One file per agent, no conflicts.

```
Agent A writes: checkpoints/claude-code.md
Agent B writes: checkpoints/antigravity-gemini.md
↓
No conflicts (different files)
↓
Git merge succeeds automatically
↓
/opp reads all checkpoints, merges in memory
```

The key insight: **Move the merge from Git (file-level) to your code (read-time).**
