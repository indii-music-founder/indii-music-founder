# Preventative Workflow Integration

**Eastern Medicine Approach:** Pattern detection embedded in the workflow system, not as manual commands.

Hidden bugs get caught at strategic checkpoints, automatically, before they reach production.

---

## The Philosophy

**Reactive (Western Medicine):**
```
Write code → Test it → Bug found → Fix it → Ship
                         ↑
                    Too late, user saw it
```

**Preventative (Eastern Medicine):**
```
Start session → Check health baseline → Write code → Mid-check → Verify improvements → Ship
     ↑                                      ↑                          ↑
  Pattern scan                        Pattern check               Pattern verified
```

---

## How It's Integrated

### Phase 1: Session Start (`/start`)

**New Step 2:** Pattern Health Baseline

```bash
/start
├─ Step 1: Context assessment
├─ Step 2: ⭐ Pattern health baseline (NEW)
│  ├─ Run: npm run detect:bugs
│  ├─ Establish: Risk score at session start
│  ├─ Document: What patterns currently exist
│  └─ Decision: "Tackle patterns first?" if score > 70
├─ Step 3: Environment bootstrap
├─ Step 4: Architecture diagram
└─ Step 5: Sub-command routing
```

**What it does:**
- Detects: 7 hidden bug patterns
- Reports: Risk score + breakdown
- Decides: Proceed with task vs. fix patterns first

**Example output:**
```
PATTERN HEALTH BASELINE
Risk Score: 146/100 🚨 CRITICAL

Patterns:
  1. Module init bugs: 1
  2. Base64 payloads: 63
  3. Unvalidated calls: 46
  4. Unprotected async: 495
  5. Firebase coupling: 21
  6. Broken chains: 52
  7. Enum typos: 7

Recommendation: Fix patterns before proceeding
```

---

### Phase 2: Mid-Task Monitoring

**Optional Step in `/go` or `/middle`:**

```bash
/middle
├─ Check point: Pattern detection (OPTIONAL)
│  ├─ Run: npm run detect:bugs
│  ├─ Compare: Against baseline
│  └─ Action: If score increased, stop and fix
└─ Continue task or pivot to pattern fixes
```

**What it does:**
- Detects: Have we added new patterns while coding?
- Blocks: If patterns got worse (score increased)
- Pivots: "Fix patterns first, then continue"

---

### Phase 3: Session End (`/end`)

**New Step 2:** Pattern Health Verification

```bash
/end
├─ Step 1: Finalization review
├─ Step 2: ⭐ Pattern health verification (NEW)
│  ├─ Run: npm run detect:bugs
│  ├─ Compare: Final score vs. baseline
│  ├─ Block: If score worsened (return to fix)
│  └─ Report: "Improved 146→130 (-16)"
├─ Step 3: Documentation & ledger update
├─ Step 4: Final architecture
├─ Step 5: Polish pass
└─ Step 6: CI gauntlet & push
```

**What it does:**
- Detects: Final pattern score
- Compares: Against baseline from session start
- Blocks: Push if patterns got worse
- Reports: Session delta in closing notes

**Example flow:**
```
Session Start:    Risk Score 146
↓
Code work...
↓
Session End:      Risk Score 143
✅ Improved by 3 points
✅ Proceed to push
```

---

### Phase 4: Advancement Gate (`/proceed`)

**New Gating Step:**

```bash
/proceed (to next task)
├─ Pattern gate check
│  ├─ Run: npm run detect:bugs
│  ├─ Score 0-30:   ✅ Auto-proceed
│  ├─ Score 31-70:  ⚠️ Requires review, can proceed with y/n
│  ├─ Score 71-100: ❌ Requires fix before proceeding
│  └─ Score 100+:   ❌ CRITICAL, immediate action required
└─ Continue or pivot to health fixes
```

**What it does:**
- Blocks: Advancement if patterns too risky
- Requires: Explicit decision at high-risk thresholds
- Prevents: Shipping with known bad patterns

---

## Decision Matrix

| Where | When | Score Range | Action | Proceed? |
|-------|------|-------------|--------|----------|
| `/start` | Session start | Any | Document baseline | Always ✅ |
| `/middle` | Mid-task | Increased | Stop, fix patterns | No ❌ |
| `/end` | Session finish | Any | Verify improvement | Only if ≥ baseline |
| `/proceed` | Next task | 0-30 | Auto-proceed | Yes ✅ |
| `/proceed` | Next task | 31-70 | Review required | Conditional ⚠️ |
| `/proceed` | Next task | 71+ | Fix required | No ❌ |

---

## The Workflow Loop

```
┌─ Session 1 ─┐
│             │
/start ──────────→ Baseline: 146
(health check)
│             │
├─ Code work  │
│             │
/end ─────────────→ Final: 143
(health verify)     Improved! ✅
│             │
└─────────────┘
     ↓
   Push ✅
     ↓
┌─ Session 2 ─┐
│             │
/start ──────────→ Baseline: 143
(health check)    (starting from where we left off)
│             │
/proceed ─────────→ Gate check
             Proceed? Yes ✅
│             │
├─ Code work  │
│             │
/end ─────────────→ Final: 138
             Improved! ✅
│             │
└─────────────┘
     ↓
   Push ✅
```

---

## Example Session: Creative Module Refactor

### Session Start

```
/start
→ Health baseline: 146
  • Base64 in creative: 63
  • Unprotected awaits in creative: 495
  • Firebase coupling in creative: 6

Question: "High-risk creative module. Tackle health first?"
→ "Yes, let's add error handling tests"
```

### Mid-Session

```
/middle
→ Detect: Score jumped to 155
→ Action: "You added 9 new unprotected awaits"
→ Block: "Fix these first before continuing other work"
→ You add try-catch to new code
→ /health again: Score back to 148
→ Continue
```

### Session End

```
/end
→ Health verification: 148
→ Baseline: 146
→ Report: "Added 3 new error handling tests, patterns stable (-2 overall)"
→ Action: ✅ Proceed to push

/ci-validate passes
→ Push to GitHub
→ Deploy
```

---

## Implementation in Workflows

### Updated `/start.md`

```markdown
## 2. Pattern Health Baseline (via `/health`)
Before touching any code, establish the current codebase health:
- Run pattern detector to establish baseline risk score
- Document any existing patterns (will compare at session end)
- If risk score > 70, ask user: "Do you want to tackle hidden bug patterns first?"
```

### Updated `/end.md`

```markdown
## 2. Pattern Health Verification (via `/health`)
Before finalizing, verify patterns didn't get worse:
- Run pattern detector again to get final risk score
- **Compare to baseline:** Did score improve, stay same, or worsen?
  - ✅ Improved or same: Continue to closing process
  - ❌ Worsened: STOP, fix patterns first
- **Report delta:** "Baseline 100 → Final 95 (-5 improvement)"
```

---

## Automation in CI

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Health check gate
  run: |
    npm run detect:bugs | tee health-report.txt
    SCORE=$(grep "RISK SCORE:" health-report.txt | grep -o "[0-9]*" | head -1)
    if [ "$SCORE" -gt 50 ]; then
      echo "❌ Risk score $SCORE > 50. Patterns must be fixed before merge."
      exit 1
    fi
    echo "✅ Health check passed. Score: $SCORE"
```

This blocks PRs with score > 50 automatically.

---

## Success Metrics

### Weekly Tracking

```bash
# Every Monday, log the score
npm run detect:bugs | grep "RISK SCORE:"

# Plot trend
Week 1:  146
Week 2:  143
Week 3:  138
Week 4:  130
...
Goal:     < 50
```

### Per-Sprint Goal

```
Sprint Goal: "Reduce pattern risk from 146 → 120"

/start → Baseline: 146
/end   → Final: 120 ✅
Success: Prevented 26 points of pattern drift
```

### Per-Release Gate

```
Before shipping:
  Risk score < 50 ✅
  All critical patterns < 5 ✅
  Base64→URI migration complete ✅
  Async errors handled ✅
```

---

## The Shift

**Before:** Patterns discovered in production ("Why did this break?")

**Now:** Patterns detected at session start ("Let me add tests for this")

**Result:** Fewer surprises. More confidence. Better code.

---

## See Also

- `.agent/skills/health-check/SKILL.md` — Full skill definition
- `scripts/detect-hidden-bugs.sh` — Pattern detector implementation
- `docs/HIDDEN_BUG_PREVENTION.md` — Prevention system overview
- `.agent/test_ledger/GENERATION_FAILURES.md` — Bug ledger
