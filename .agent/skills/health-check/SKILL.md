---
name: health-check
description: Preventative health audit - detects hidden bug patterns before they reach production
---

# /health — Pattern Health Audit

**Preventative medicine for the codebase.** Scans for 7 hidden bug patterns that bypass normal tests, gates advancement on risk score, and prevents shipping with known anti-patterns.

---

## When to Use

- **At session start** (`/start`) — Establish baseline, see what patterns exist before touching code
- **Mid-session** (`/middle`) — Check we haven't introduced new patterns while working
- **At session end** (`/end`) — Verify patterns improved before shipping
- **As gate** (`/proceed`) — Block advancement if risk score too high
- **On demand** (`/health`) — Quick health check anytime

---

## How It Works

### Step 1: Scan for 7 Patterns
```
1. Module initialization order bugs (export before init)
2. Base64 payloads sent to APIs (should be gs:// URIs)
3. Unvalidated httpsCallable calls (payload schema mismatches)
4. Unprotected async/await (silent failures)
5. Firebase tight coupling (initialization failure propagation)
6. Broken async chains (.then without .catch)
7. String enum typos (case sensitivity bugs)
```

### Step 2: Calculate Risk Score
- Each pattern weighted by severity (1-10 points each)
- Total score: 0-100+ (higher = more risk)
- Thresholds:
  - **0-30:** Green ✅ Ship with confidence
  - **31-70:** Yellow ⚠️ Audit findings, plan fixes
  - **71-100:** Red 🔴 Block advancement, fix first
  - **100+:** Critical 🚨 Immediate action required

### Step 3: Generate Report

```
🔍 HEALTH AUDIT REPORT

1. Module Init Order ...................... 1 service
2. Base64 Payloads ........................ 63 instances
3. Unvalidated httpsCallable ............. 46 uses
4. Unprotected Async ..................... 495+ awaits
5. Firebase Coupling ..................... 21 modules
6. Broken Async Chains ................... 52 .then()
7. String Enum Typos ..................... 7 instances

RISK SCORE: 146/100 ...................... 🚨 CRITICAL

Top At-Risk Modules:
  • creative (6 httpsCallable + 495 awaits)
  • touring (3 httpsCallable)
  • marketing (1 httpsCallable)

RECOMMENDATIONS:
  1. Run integration tests: npm run test:api
  2. Prioritize creative module async safety
  3. Audit Base64 instances for API send patterns
```

### Step 4: Gate Advancement

| Score | Action | Proceed? |
|-------|--------|----------|
| 0-30 | None | ✅ Yes |
| 31-70 | Review & document | ⚠️ Conditional |
| 71-100 | Must fix | ❌ No |
| 100+ | Immediate action | ❌ Absolutely not |

---

## Commands

### Run Manually

```bash
# Quick health check
npm run detect:bugs

# Full report with recommendations
bash scripts/detect-hidden-bugs.sh

# Detailed pattern breakdown
bash scripts/detect-hidden-bugs.sh --verbose
```

### Integrated in Workflows

```bash
# At session start (establish baseline)
/start
→ Detects baseline patterns
→ Shows what patterns exist before you touch code
→ Establishes "did we improve?" baseline

# At session end (verify improvements)
/end
→ Compares final patterns to baseline
→ Blocks push if patterns got worse
→ Reports improvements made

# Before advancement (gating)
/proceed
→ Checks risk score
→ Blocks if score > 70
→ Requires explicit override for 71-100 range
```

---

## Integration Points

### In `/start` Workflow (New Step 1.5)

```markdown
## 1.5 Pattern Health Baseline (via `/health`)
Before beginning work, establish the current health state:
- Run pattern detector to see baseline risk score
- Document any patterns that exist in the current codebase
- If risk score > 70, ask: "Do you want to tackle hidden bugs first?"
- Use baseline to measure improvements by session end
```

### In `/end` Workflow (New Step 2.5)

```markdown
## 2.5 Pattern Health Improvement Verification
Before pushing, verify you didn't make things worse:
- Run pattern detector again
- Compare score to baseline
- If score increased: STOP, investigate what patterns you added
- If score same or lower: ✅ Continue to CI gauntlet
- Report pattern delta in session notes
```

### In `/proceed` Workflow (New Gate Step)

```markdown
## Pattern Health Gate (MANDATORY)
Before advancing to next task:
- Run pattern detector
- If score 0-30: Auto-proceed ✅
- If score 31-70: Show findings, require explicit y/n
- If score 71+: Block and require pattern fixes first
```

---

## Real-World Usage Examples

### Example 1: Starting a Creative Module Feature

```
/start
→ Detect baseline: risk score 146 (critical)
→ Shows: 63 Base64 instances, 495 unprotected awaits in creative
→ You: "Okay, I see the health issues. I'll be careful not to add more."
→ Proceed with full awareness of at-risk code

/end
→ Detect final: risk score 145 (1 improvement!)
→ You avoided adding new patterns ✅
→ Report: "Added 3 new tests to creative module, risk stable"
→ Proceed to push
```

### Example 2: Discovering a New Pattern

```
/middle
→ Detect: score jumped from 100 to 115
→ New pattern: You added 15 unprotected awaits
→ System: "⚠️ You added patterns. Fix them first."
→ You: Add try-catch to those awaits
→ /health again: score back to 100 ✅
→ Continue
```

### Example 3: Gating a Risky Task

```
/proceed (to next task)
→ Detect: score 75
→ System: "Score 75 > 70. Can't proceed without override."
→ System: "Do you want to fix patterns first? (y/n)"
→ You: "Let me fix the 21 Firebase coupling modules first"
→ Fix modules
→ /proceed again: score 45 ✅
→ Proceed to next task
```

---

## What It DOES Catch

✅ Services exported before initialization
✅ Base64 payloads sent to APIs (should be URIs)
✅ Unvalidated API payloads (schema mismatches)
✅ Silent async failures (no error handling)
✅ Undeployed initialization (tight coupling)
✅ Broken promise chains (missing .catch)
✅ Type-unsafe enums (string comparisons)

---

## What It DOES NOT Catch

❌ Logic bugs (wrong algorithm)
❌ UI bugs (CSS, layout)
❌ Security vulnerabilities (SQL injection)
❌ Performance issues (slow queries)
❌ Accessibility bugs (WCAG violations)

**For these:** Use unit tests, E2E tests, security scanners, profilers, axe-core.

---

## Maintenance

### Weekly

```bash
# Check if patterns are drifting
npm run detect:bugs

# If score creeping up: add this to sprint
# "Reduce hidden bug pattern score from X to Y"
```

### Per-Task

```bash
# At start: establish baseline
npm run detect:bugs | tee pattern-baseline.txt

# At end: compare
npm run detect:bugs | diff pattern-baseline.txt - | grep "^[<>]"
```

### Per-Release

```bash
# Before shipping: MUST be < 50
npm run detect:bugs

# If >= 50: resolve before shipping
```

---

## Integration with Other Skills

| Skill | How /health Fits |
|-------|-----------------|
| `/start` | Establish baseline |
| `/go` | Check mid-task, mid-PR |
| `/middle` | Catch pattern drift |
| `/end` | Verify improvements |
| `/proceed` | Gate advancement on risk |
| `/test` | Focus on high-risk modules |
| `/better` | Target pattern reduction first |

---

## Config

No additional config needed. Pattern detector runs directly on source.

Optional: Add to `.github/workflows/deploy.yml` to block merges with score > 50:

```yaml
- name: Health check
  run: |
    npm run detect:bugs | tee health-report.txt
    SCORE=$(grep "RISK SCORE:" health-report.txt | grep -o "[0-9]*" | head -1)
    if [ "$SCORE" -gt 50 ]; then
      echo "❌ Risk score $SCORE exceeds 50. Fix patterns before merging."
      exit 1
    fi
```

---

## When to Call It Done

Health audit is "done" when:
- ✅ Risk score baseline established at session start
- ✅ Patterns tracked throughout session
- ✅ Risk score same or lower at session end
- ✅ New patterns documented in `.agent/test_ledger/GENERATION_FAILURES.md`
- ✅ Improvements reported in session notes

---

## See Also

- `docs/TESTING_STRATEGY.md` — Three-layer testing approach
- `docs/HIDDEN_BUG_PREVENTION.md` — Complete prevention system
- `.agent/test_ledger/GENERATION_FAILURES.md` — Bug ledger
- `scripts/detect-hidden-bugs.sh` — Pattern detector implementation
