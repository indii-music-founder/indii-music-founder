# Walk Skill v1.0

> You were out walking the dog. This skill picks up exactly where your mobile
> session left off and drives everything to verified completion — tests green,
> vulns fixed, code shipped, nothing left on the floor.

---

## Trigger

- `/walk` — invoke manually when you get home
- "I'm back", "just got home", "pick up where we left off"
- Automatically wired into SessionStart when mobile handoff is detected

---

## Protocol

### Phase 1: Handoff Triage

Read `.agent/HANDOFF_STATE.md` in full.

Extract and display:
1. **What was built** — list every file changed, every decision made
2. **What's pending** — P0/P1 items still outstanding from the mobile session
3. **Manual steps** — anything that requires external access (GCP, external APIs)
4. **Branch** — confirm you're on the right branch, pull latest

```bash
git fetch origin
git status
git pull origin "$(git branch --show-current)" 2>/dev/null || true
echo "--- HANDOFF ---"
cat .agent/HANDOFF_STATE.md
```

Show the user a clean summary before doing anything else:

```
## Walk Report — Picking Up From Mobile

**Branch:** <branch>
**Last mobile checkpoint:** <timestamp from HANDOFF_STATE.md>

### Built on mobile:
- <item 1>
- <item 2>

### Still pending:
- [ ] <P0 item>
- [ ] <P1 item>

### Manual steps needed (can't auto-run):
- [ ] <external step>

Proceeding to execute all pending items now...
```

---

### Phase 2: Environment Bootstrap

Get the machine fully ready before doing any work.

```bash
# Install dependencies if node_modules is missing or empty
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Install functions dependencies if needed
if [ -f "functions/package.json" ] && [ ! -d "functions/node_modules" ]; then
  echo "Installing functions dependencies..."
  cd functions && npm install && cd ..
fi
```

---

### Phase 3: Execute All Pending P0 Items

Work through every P0 item from the handoff one by one.

For **each P0 item**:
1. State what you're doing
2. Execute it
3. Verify it worked
4. Mark it done

**Standard P0 checks to always run:**

```bash
# Dependency vulnerabilities
echo "=== npm audit fix ==="
npm audit fix 2>&1 | tail -10

# TypeScript
echo "=== typecheck ==="
npm run typecheck 2>&1 | tail -20

# Lint
echo "=== lint ==="
npm run lint 2>&1 | tail -10
```

**If any step fails:** diagnose the root cause, fix it, re-run. Do NOT skip or mark done until it actually passes.

---

### Phase 4: Test Suite — Loop Until Green

```bash
npm test -- --run 2>&1
```

Classify each failure:
- **In-branch** (caused by work done this session) → fix immediately, re-run
- **Pre-existing** (existed before this session) → document, do not fix unless blocking
- **Environmental** (missing env var, missing API key) → document, mark as known

Loop: run tests → fix failures → run tests again. Stop when green or only pre-existing/environmental failures remain.

---

### Phase 5: Prime Check

Verify the codebase is in prime condition — ready to deploy.

Run all checks in parallel:

```bash
echo "=== BUILD ==="
npm run build:studio 2>&1 | tail -10

echo "=== AUDIT ==="
npm audit --json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
m=d.get('metadata',{}).get('vulnerabilities',{})
print(f'critical:{m.get(\"critical\",0)} high:{m.get(\"high\",0)} moderate:{m.get(\"moderate\",0)}')
" 2>/dev/null

echo "=== TESTS ==="
npm test -- --run --reporter=verbose 2>&1 | tail -5
```

**Prime = all of the following:**
- [ ] TypeScript: 0 errors
- [ ] Lint: 0 errors (warnings OK)
- [ ] Tests: all pass (or only pre-existing failures documented)
- [ ] Build: production bundle compiles
- [ ] Audit: 0 critical vulns (or documented exceptions with rationale)
- [ ] Branch: committed and pushed

If any check fails, fix it before proceeding.

---

### Phase 6: Manual Steps Handoff

For anything that requires external access (GCP console, third-party dashboards, API calls to external services), print a clear actionable checklist. Do NOT skip these — they are real security or functionality gaps.

Example format:
```
## Manual Steps Required (cannot auto-execute)

These cannot be done by the agent — they need you directly:

- [ ] GCP Secret Manager → add TELEGRAM_WEBHOOK_SECRET
      Command: firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
      Then: call Telegram setWebhook API with secret_token param

- [ ] GCP Secret Manager → add PANDADOC_WEBHOOK_SECRET
      Command: firebase functions:secrets:set PANDADOC_WEBHOOK_SECRET
      Then: PandaDoc Dashboard → Webhooks → Shared Key → paste same value

- [ ] Run setup-git-hooks on this machine:
      bash .claude/scripts/setup-git-hooks.sh
```

---

### Phase 7: Final Commit & Push

```bash
# Stage any remaining changes
git add -A
git status

# Only commit if there's something to commit
if ! git diff --cached --quiet; then
  git commit -m "chore: walk session — drive to prime from mobile handoff"
  git push origin "$(git branch --show-current)"
fi
```

Then write a final HANDOFF_STATE.md update:

```bash
bash .claude/scripts/checkpoint.sh
```

---

### Phase 8: Walk Report

Output the final status clearly:

```
## Walk Complete ✓

**Session:** mobile → home
**Branch:** <branch> — pushed

### What Was Finished:
- [x] <completed item>
- [x] <completed item>

### Prime Status:
- [x] TypeScript: clean
- [x] Lint: clean
- [x] Tests: N passed
- [x] Build: success
- [x] Audit: no criticals
- [x] Pushed: <commit hash>

### Manual Steps Still Needed:
- [ ] <external step with exact command>

### Verdict: READY TO DEPLOY / BLOCKED BY <reason>
```

---

## Notes

- This skill is safe to run multiple times — it's idempotent
- If a P0 item is already done, confirm it's done and move on
- Never mark the walk complete until you've verified Prime status
- The dog was walked. The code ships.
