# Walk Skill v1.1

> You were out walking the dog. This skill picks up exactly where the mobile
> session left off and drives everything to verified completion — tests green,
> vulns fixed, code shipped, nothing left on the floor.
>
> Works in any IDE or agent environment: antigravity, Claude Code, Cursor, etc.
> No hooks required — everything is explicit.

---

## Trigger

- User says: "walk", "/walk", "I'm home", "just got back", "pick up where we left off"
- `node_modules` is empty/absent at session start (fresh machine detected)
- Any agent reading GEMINI.md / CLAUDE.md on a machine that hasn't run `npm install`

---

## Protocol

### Phase 1: Handoff Triage

Read `.agent/HANDOFF_STATE.md` fully. Then run:

```bash
git fetch origin 2>/dev/null || true
git pull origin "$(git branch --show-current)" 2>/dev/null || true
git status --short
git log --oneline -5
```

Display a clean summary before touching anything:

```
## Walk — Picking Up From Mobile

Branch: <branch>
Last checkpoint: <timestamp from HANDOFF_STATE.md>

Built on mobile:
- <every file and decision from HANDOFF_STATE.md>

Still pending:
- [ ] <P0 item>
- [ ] <P1 item>

Manual steps (need you, not me):
- [ ] <external step>

Starting execution now...
```

---

### Phase 2: Environment Bootstrap

```bash
# Root dependencies
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing root dependencies..."
  npm install
fi

# Functions dependencies
if [ -f "functions/package.json" ] && \
   ([ ! -d "functions/node_modules" ] || [ -z "$(ls -A functions/node_modules 2>/dev/null)" ]); then
  echo "Installing functions dependencies..."
  cd functions && npm install && cd ..
fi

# Git hooks (once per machine)
if [ ! -x ".git/hooks/pre-commit" ]; then
  bash .claude/scripts/setup-git-hooks.sh
fi
```

---

### Phase 3: Execute All Pending P0 Items

Work through every P0 item from the handoff one at a time.

**Standard checks — always run these regardless of what the handoff says:**

```bash
echo "=== npm audit fix ==="
npm audit fix 2>&1 | tail -10

echo "=== typecheck ==="
npm run typecheck 2>&1 | tail -20

echo "=== lint ==="
npm run lint 2>&1 | tail -10
```

Rule: **Do not move to Phase 4 until every P0 item passes.** If something fails, diagnose → fix → re-run. No skipping.

---

### Phase 4: Test Suite — Loop Until Green

```bash
npm test -- --run 2>&1
```

Classify each failure:
- **In-branch** — caused by work done this session → fix immediately, re-run
- **Pre-existing** — existed before this branch → document, skip unless blocking ship
- **Environmental** — missing env var, missing external service → document, mark known

Keep running until green or only pre-existing/environmental failures remain.

---

### Phase 5: Prime Check

Everything has to pass before the walk is done.

```bash
echo "=== BUILD ===" && npm run build:studio 2>&1 | tail -10
echo "=== AUDIT ===" && npm audit --json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
m=d.get('metadata',{}).get('vulnerabilities',{})
print(f'critical:{m.get(\"critical\",0)} high:{m.get(\"high\",0)} moderate:{m.get(\"moderate\",0)}')
" 2>/dev/null
echo "=== TESTS ===" && npm test -- --run 2>&1 | tail -5
```

**Prime checklist:**
- [ ] TypeScript: 0 errors
- [ ] Lint: 0 errors (warnings OK)
- [ ] Tests: all pass (or pre-existing failures documented)
- [ ] Build: production bundle compiles
- [ ] Audit: 0 criticals (or documented with rationale)
- [ ] Branch: committed and pushed

---

### Phase 6: Manual Steps

Print a clear, copy-paste-ready checklist for anything the agent cannot do:

```
## Manual Steps (you need to do these)

- [ ] firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
      Then re-register bot: POST api.telegram.org/bot<TOKEN>/setWebhook
      with body: { url: "<fn_url>", secret_token: "<same_value>" }

- [ ] firebase functions:secrets:set PANDADOC_WEBHOOK_SECRET
      Then: PandaDoc Dashboard → Webhooks → Shared Key → paste same value

- [ ] <any other step from HANDOFF_STATE.md that needs external access>
```

Never leave this section blank if there are real outstanding manual steps.

---

### Phase 7: Commit & Checkpoint

```bash
# Commit any remaining changes
git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: walk session — drive to prime from mobile handoff"
fi
git push origin "$(git branch --show-current)"

# Write final handoff state for next session
bash .claude/scripts/checkpoint.sh
```

---

### Phase 8: Walk Report

```
## Walk Complete

Session: mobile → home (antigravity IDE)
Branch: <branch> — pushed <commit>

What was finished:
  [x] <item>
  [x] <item>

Prime status:
  [x] TypeScript: clean
  [x] Lint: clean
  [x] Tests: N passed
  [x] Build: success
  [x] Audit: no criticals
  [x] Pushed: <hash>

Manual steps still needed:
  [ ] <step with exact command>

Verdict: READY TO DEPLOY
     or: BLOCKED BY <specific reason>
```

---

## Notes

- Safe to run multiple times — idempotent
- If a P0 item is already done, verify it, check it off, move on
- Never declare walk complete until Prime checklist is fully green
- Works identically in antigravity IDE, Claude Code CLI, Cursor, or any agent with terminal access
- The dog was walked. The code ships.
