# Hooks Skill v1.0

> Full-spectrum hooks management for indiiOS. Discovers, audits, evaluates,
> recommends, and implements hooks across every layer of the stack.

---

## Trigger Patterns

Invoke this skill when the user says anything related to:
- "audit hooks", "check hooks", "review hooks", "what hooks do we have"
- "hooks not firing", "hook broken", "hook isn't working"
- "improve hooks", "optimize hooks", "better hooks"
- "suggest new hooks", "what hooks should we add"
- "remove this hook", "disable hook", "clean up hooks"
- Any debugging of a specific hook behavior

---

## Scope

This skill covers **all hook layers** in indiiOS:

| Layer | Location | Type |
|-------|----------|------|
| **Agent Hooks** | `.claude/settings.json` + `.claude/scripts/` | Claude Code lifecycle |
| **React Hooks** | `src/hooks/` | Custom React hooks |
| **Module Hooks** | `src/modules/**/hooks/` | Feature-level React hooks |
| **Firebase Triggers** | `functions/src/` | Firestore, Auth, HTTP, Scheduled |
| **Inngest Jobs** | `functions/src/` | Background job event triggers |
| **Webhook Endpoints** | `src/services/`, `functions/src/` | Stripe, distribution, external |
| **Git Hooks** | `.git/hooks/`, `package.json` (husky) | Pre-commit, pre-push, commit-msg |

---

## Protocol

### Phase 1: Discovery (run ALL in parallel)

Simultaneously collect:

1. **Agent hooks** — Read `.claude/settings.json`, list every event + command + timeout
2. **Script hooks** — Glob `.claude/scripts/**` and read each file
3. **React hooks** — Glob `src/hooks/**/*.{ts,tsx}` and `src/modules/**/hooks/**/*.{ts,tsx}`
4. **Firebase triggers** — Grep `functions/src/` for `onDocumentCreated`, `onDocumentUpdated`, `onDocumentDeleted`, `onSchedule`, `onCall`, `onRequest`, `beforeUserCreated`, `onUserDeleted`
5. **Inngest** — Grep `functions/src/` for `inngest.createFunction`, `serve`, event trigger names
6. **Webhooks** — Grep `src/services/`, `functions/src/` for `webhook`, `stripe.webhooks.constructEvent`, incoming HTTP handlers
7. **Git hooks** — Read `.git/hooks/` directory listing; check `package.json` for `husky` or `lint-staged`

Build a **master hooks inventory** before proceeding.

---

### Phase 2: Evaluate Each Hook

For every hook found, assess across five dimensions:

#### 2a. Correctness
- Is the trigger condition right? (correct event, matcher, path)
- Will it fire when expected? Will it fire when it shouldn't?
- Are dependencies/inputs correctly handled?

#### 2b. Reliability
- Does it handle failures gracefully (`|| true`, try/catch, error logging)?
- Is there a timeout? Is it appropriate?
- Is it idempotent — safe to run multiple times?
- Could it leave the system in a bad state if interrupted?

#### 2c. Performance
- Does it block the critical path unnecessarily?
- Should it be `async: true` (fire-and-forget) or synchronous (blocking)?
- Does it do expensive I/O on every invocation?

#### 2d. Necessity
- Is this hook still needed?
- Does another hook already cover this?
- Is there a simpler way to achieve the same result?

#### 2e. Security
- Could a hook be used to exfiltrate data or run dangerous commands?
- Are webhook payloads verified (signature check)?
- Are secrets handled correctly (env vars, not hardcoded)?

---

### Phase 3: Gap Analysis

Cross-reference the inventory against this known-good pattern list.
Flag any gaps as P2 recommendations.

#### Agent Hook Gaps to Check
- [ ] `Stop` → auto-checkpoint session state (we have this ✓)
- [ ] `SessionStart` → inject previous session context (we have this ✓)
- [ ] `PostToolUse` on `Write|Edit` → lint/typecheck modified `.ts/.tsx` files
- [ ] `PostToolUse` on `Write|Edit` → auto-format with Prettier
- [ ] `UserPromptSubmit` → inject current branch + PR context into every prompt
- [ ] `PreCompact` → save key decisions/context before compaction wipes memory
- [ ] `PreToolUse` on `Bash` → flag/log destructive shell commands (`rm`, `drop`, `reset --hard`)

#### React Hook Gaps to Check
- [ ] Every Firebase listener (`onSnapshot`, `onAuthStateChanged`) has a cleanup return
- [ ] Every `useEffect` with external subscriptions unsubscribes on unmount
- [ ] No duplicate hooks that mirror Zustand store state (prefer store reads)
- [ ] Audio/video/canvas hooks release resources on unmount
- [ ] No `useEffect` with empty dep array `[]` that should have deps

#### Firebase / Inngest Gaps to Check
- [ ] All Firestore triggers have try/catch and log errors to Cloud Logging
- [ ] Scheduled functions have idempotency guards (check if already ran)
- [ ] Stripe webhook handler verifies `stripe.webhooks.constructEvent` signature
- [ ] Auth triggers clean up user data on delete (GDPR)
- [ ] Inngest functions have retry + failure handling configured

---

### Phase 4: Produce Recommendations

Output a prioritized recommendation list using this severity model:

| Priority | Meaning | Action |
|----------|---------|--------|
| **P0** | Broken or dangerous — fix immediately | Fix before anything else |
| **P1** | Working but wrong/risky — should fix | Fix in current session |
| **P2** | Missing value — should add | Add in current or next session |
| **P3** | Redundant or low value — should remove | Remove to reduce complexity |

For each recommendation, provide:
- What: one-sentence description
- Why: the specific risk or opportunity
- How: exact implementation (code snippet or file path + change)

---

### Phase 5: Implement (execute on request)

When the user confirms a recommendation, implement it immediately:

#### Agent Hook Changes
- Edit `.claude/settings.json` following the merge pattern (never replace, always merge)
- Create/modify scripts in `.claude/scripts/`
- Validate with: `jq -e '.hooks.<EVENT>[]' .claude/settings.json`
- Pipe-test the command before committing
- Commit + push

#### React Hook Changes
- Create/modify in `src/hooks/` or the appropriate module's `hooks/` directory
- Follow existing naming conventions (`use<Name>.ts`)
- Run `npm test -- --run` to verify nothing breaks

#### Firebase / Inngest Changes
- Modify `functions/src/`
- Ensure types compile: `cd functions && npm run build`

#### Git Hook Changes
- If using Husky: update `.husky/` scripts or `package.json` `lint-staged`
- If raw: write to `.git/hooks/<name>` and `chmod +x`

---

## Output Format

Always produce a structured report, even for partial runs:

```
## Hooks Audit — indiiOS
Ran: <timestamp>

---

### Inventory

#### Agent Hooks (.claude/settings.json)
| Event | Command | Async | Timeout | Status |
|-------|---------|-------|---------|--------|
| Stop | checkpoint.sh | yes | 30s | ✓ Active |
| SessionStart | load-context.sh | no | 10s | ✓ Active |

#### React Hooks (src/hooks/)
| Hook | File | Purpose | Issues |
...

#### Firebase Triggers (functions/src/)
| Trigger | Event | Collection/Path | Issues |
...

#### Webhook Handlers
| Endpoint | Source | Verified | Issues |
...

---

### Recommendations

**P0 — Fix Immediately**
- [ ] ...

**P1 — Should Fix**
- [ ] ...

**P2 — Should Add**
- [ ] ...

**P3 — Consider Removing**
- [ ] ...

---

### Summary
X hooks audited. Y issues found (Z P0, A P1, B P2, C P3).
```

---

## Known Good Agent Hook Templates

Copy-paste ready. Test before using.

### Lint on Edit
```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | grep -E '\\.(ts|tsx)$' | { read -r f; [ -n \"$f\" ] && npx eslint --fix \"$f\" 2>/dev/null || true; }",
      "timeout": 30,
      "statusMessage": "Linting...",
      "async": true
    }]
  }]
}
```

### Typecheck on Edit
```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": "jq -r '.tool_input.file_path // empty' | grep -E '\\.(ts|tsx)$' | { read -r f; [ -n \"$f\" ] && npm run typecheck 2>&1 | tail -5 || true; }",
      "timeout": 60,
      "statusMessage": "Typechecking...",
      "async": true
    }]
  }]
}
```

### Branch Context on Prompt Submit
```json
{
  "UserPromptSubmit": [{
    "hooks": [{
      "type": "command",
      "command": "BRANCH=$(git branch --show-current 2>/dev/null); echo \"{\\\"hookSpecificOutput\\\":{\\\"hookEventName\\\":\\\"UserPromptSubmit\\\",\\\"additionalContext\\\":\\\"Current branch: $BRANCH\\\"}}\"",
      "timeout": 5
    }]
  }]
}
```

### Pre-Compact Context Save
```json
{
  "PreCompact": [{
    "hooks": [{
      "type": "command",
      "command": "bash .claude/scripts/checkpoint.sh",
      "timeout": 30,
      "statusMessage": "Saving context before compaction..."
    }]
  }]
}
```

---

## Self-Improvement

After each run, append new patterns discovered to this section:

### Discovered Patterns
<!-- append new hook patterns, anti-patterns, and fixes here -->
