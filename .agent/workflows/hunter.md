---
description: Full-spectrum codebase bug hunter — surfaces security, data integrity, performance, and correctness issues across the entire indii stack. Covers both Big Game (surface-level) and Small Game (subtle) bugs. In HUNT mode it fixes, verifies, and commits; in AUDIT mode it records findings in OPEN_ISSUES.md and preserves supporting evidence only.
---

# /hunter — Full-Spectrum Bug Hunter

> **PERSONA:** You are the Hunter. Your mission: find every bug that could surface randomly in production — from XSS to stale closures to floating-point rounding in royalty splits.

## Mode Selection (NEW)

- **HUNT** (default): Find ALL bugs + fix + verify + commit in this session.
- **AUDIT** (find-only): Find ALL bugs + document for another agent to fix. Output: `.agent/test_ledger/OPEN_ISSUES.md` entries + supporting evidence doc + GitHub issues for Critical/High findings.

Infer from context:
- Explicit "audit" or "find-only" → AUDIT mode
- `/hunter` alone → HUNT mode (legacy default)
- If ambiguous, ask

// turbo-all

## Phase 1: Big Game (Surface Scan)

Run all scans in parallel. These catch low-hanging fruit fast.

### 1.1 Security Vectors
```bash
# XSS: dangerouslySetInnerHTML
grep -rn 'dangerouslySetInnerHTML' packages/renderer/src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Hardcoded secrets
grep -rn 'sk_live\|sk_test\|ghp_\|AIza' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'MOCK_KEY' | grep -v 'import.meta.env'

# process.env in browser context (should be import.meta.env)
grep -rn 'process\.env\.' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v 'VITEST\|NODE_ENV\|import\.meta' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- `dangerouslySetInnerHTML` → Replace with `<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>` or add DOMPurify sanitization
- Hardcoded secrets → Extract to `.env` using `SERVICE_FEATURE_KEY` naming, replace with `import.meta.env.VITE_*`
- `process.env` in browser → Replace with `import.meta.env.VITE_*`

### 1.2 Memory Leaks
```bash
# Event listener mismatch (add vs remove counts)
echo "=== addEventListener ===" && grep -rn 'addEventListener' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "=== removeEventListener ===" && grep -rn 'removeEventListener' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l

# Firestore onSnapshot without matching unsubscribe
grep -rn 'onSnapshot' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- Missing `removeEventListener` → Add cleanup in `useEffect` return or component unmount
- Leaked `onSnapshot` → Store unsubscribe via `registerSubscription()` or return it from `useEffect`

### 1.3 Loading State Traps
```bash
# Loading gates that block ALL rendering with no timeout/fallback
# These cause infinite spinners when the underlying service fails silently
grep -rn 'if.*Loading.*return' packages/renderer/src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Init functions that set loading=true but have no timeout
grep -rn 'authLoading\|isLoading.*true\|loading: true' packages/renderer/src/core/store/slices/ --include='*.ts' | grep -v '.test.'

# CI/CD env var mismatch: check deployed key matches local key
grep 'VITE_FIREBASE_API_KEY' .env
# Compare with: GitHub Settings → Secrets → VITE_FIREBASE_API_KEY
```

**AUTO-FIX:** For each finding:
- Loading gate with no timeout → Add a `setTimeout` failsafe (10s) that forces `loading=false` with an error message
- Init function with no error path → Add `try/catch` that sets `loading: false` + descriptive `error`
- CI/CD key mismatch → Flag to user with exact key values for comparison

### 1.4 Swallowed Errors
```bash
# Empty catch blocks (silent failure)
grep -rn 'catch.*{}' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Raw console.log (should use logger)
grep -rn 'console\.log' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v '//'
```

**AUTO-FIX:** For each finding:
- Empty catch → Add `logger.error()` and `Sentry.captureException()` 
- Raw `console.log` → Replace with `logger.debug()` or `logger.info()`

### 1.5 HTTP Error Codes
```bash
# Unhandled response codes
grep -rn '!response.ok' packages/renderer/src/services/ --include='*.ts' | grep -v 'status\|429\|502\|503' | grep -v test

# Missing retry logic for 429 rate limits
grep -rn 'fetch(' packages/renderer/src/services/ --include='*.ts' | grep -v 'retry\|backoff\|429' | grep -v test | grep -v '.d.ts'
```

**AUTO-FIX:** For each finding:
- Missing status check → Add `if (!response.ok)` with appropriate error handling
- Missing retry → Wrap in retry logic for 429/5xx codes

### 1.6 API System Integrity (NEW)
```bash
# Detect ghost test duplicates and legacy AI imports
node scripts/verify-api-system-integrity.js
```

**AUTO-FIX:** For each finding:
- Duplicate test files → Delete the redundant file that is in the incorrect location (prefer `__tests__/` for isolated tests, or standard paths).
- Banned AI logic (`DirectImageEditor`, `FallbackClient`) → Refactor out and route through `httpsCallable` Firebase Cloud Functions.
- `VITE_API_KEY` → Remove from client usage and route through Cloud Functions.

### 1.6 Vendor Chunk Conflicts
```bash
# Check manualChunks (electron.vite.config.ts + packages/renderer/vite.config.ts) for React-dependent libs split from vendor-react
# Any lib that imports react-reconciler, scheduler, or react-dom MUST be in vendor-react
grep -A 30 'manualChunks' electron.vite.config.ts packages/renderer/vite.config.ts

# Check for scheduler duplication in production build
npm run build:studio 2>&1 | grep -i 'scheduler\|reconciler' || echo 'No scheduler warnings'
```

**AUTO-FIX:** For each finding:
- React-dependent lib in separate chunk (e.g. @react-three/fiber, @remotion/*) → Move to vendor-react or remove from manualChunks
- Scheduler duplication warning → Consolidate into single React vendor chunk

### 1.7 Impure Render Functions
```bash
# Math.random() in render — violates react-hooks/purity, causes lint failure
grep -rn 'Math\.random()' packages/renderer/src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v 'useMemo\|useCallback\|useRef'

# Date.now() in render (non-deterministic)
grep -rn 'Date\.now()' packages/renderer/src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'useMemo\|useCallback\|useRef\|useEffect'
```

**AUTO-FIX:** For each finding:
- Math.random() in render → Replace with deterministic seeded RNG or frame-based calculation
- Date.now() in render → Move to useEffect or useMemo

### 1.8 Anti-AI Slop (Clean-Up Scan)
```bash
# Lazy AI placeholders
grep -rn '\.\.\. rest of code\|\.\.\. implementations here\|TODO.*implement' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.'

# AI conversational boilerplate
grep -rn 'Here is the.*code\|As an AI' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.'
```

**AUTO-FIX:** For each finding:
- Boilerplate text → Delete the text from the file completely.
- Lazy placeholders (`// ... rest of code`) → You MUST read the original file, synthesize the missing logic, and implement it fully. NEVER just delete the placeholder without implementing the code.

### 1.9 Infrastructure Identity Leaks (The Ghost Project Sweep)
```bash
# Suspended project IDs and old app credentials
grep -rn 'indii-v-1-1\|223837784072' packages/ scripts/ execution/ load-tests/ --include='*.ts' --include='*.js' --include='*.sh' --include='*.py' | grep -v node_modules
```

**AUTO-FIX:** For each finding:
- Ghost Project IDs → You MUST replace them with the active project `indii-music-founder` (and its active ID `148015878263`). 
- Check the GitHub CLI `gh secret list` immediately. If the ghost ID leaked into the code, it probably leaked into the CI/CD pipeline secrets.

---

## Phase 2: Small Game (Deep Logic Read)

Read actual code line-by-line. For each file, apply fixes immediately.

### 2.1 Store & State (Zustand Slices)

Read every slice in `packages/renderer/src/core/store/slices/`:

**SCAN FOR:**
- Subscription leaks (onSnapshot without registerSubscription)
- Stale flags (loading/connecting not reset on both success AND error paths)
- Non-serializable state (callbacks/Promises stored in state)
- Selector instability (multi-property useStore without useShallow)

```bash
echo "useShallow:" && grep -rn 'useShallow' packages/renderer/src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "useStore:" && grep -rn 'useStore(' packages/renderer/src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
```

**AUTO-FIX:** For each finding:
- Subscription leak → Add `registerSubscription('descriptive-id', unsubscribe)` call
- Stale flag → Add `set({ flagName: false })` to success path
- Non-serializable → Move callbacks to a `Map` outside of Zustand state
- Missing `useShallow` → Wrap selector in `useShallow()`

### 2.2 Race Conditions

Read any file that does Firestore read-modify-write, especially in `packages/firebase/src/`:

```bash
grep -rn '\.update({' packages/firebase/src/ --include='*.ts' | grep -v 'transaction\.'
```

**AUTO-FIX:** For each finding:
- Non-atomic array update → Wrap in `db.runTransaction(async (tx) => { ... })`
- Always re-read the doc inside the transaction via `tx.get(ref)`
- Only modify the specific array element, never overwrite blindly

### 2.3 Finance & Revenue

```bash
grep -rn 'toFixed\|Math.round' packages/renderer/src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- Floating-point money → Convert to integer cents: `Math.round(amount * 100)` before operations
- Division by zero → Add guard: `denominator > 0 ? numerator / denominator : 0`

### 2.4 AI & Agent Services

```bash
grep -rn 'maxOutputTokens\|max_tokens' packages/renderer/src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each Gemini call missing `maxOutputTokens`:
- Add `maxOutputTokens: 4096` (or appropriate limit for the use case)
- Agent chat: 4096, Summary: 512, Quick tasks: 1024

### 2.5 Locale & i18n

```bash
grep -rn 'toLocaleDateString\|toLocaleString\|toLocaleTimeString' packages/renderer/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding in business-critical paths (DDEX, invoices, legal):
- Add explicit locale: `.toLocaleDateString('en-US', { ... })`
- For DDEX/ISO dates: use `.toISOString()` instead

---

## Phase 3: Verify

After ALL fixes are applied, run the full verification gauntlet:

**For UI or Frontend Bugs:**
- You MUST connect via the `chrome-devtools` MCP plugin.
- Ensure no console errors remain.
- Capture screenshots/DOM snapshots proving the UI renders without crashing and the bug is resolved.

```bash
# Frontend
npm run typecheck 2>&1 | tail -30
npx vitest run 2>&1 | tail -30
npm run build:studio 2>&1 | tail -20

# Cloud Functions (if modified)
cd packages/firebase && npx tsc --noEmit 2>&1 | tail -20 && cd ../..

# Firestore rules (if modified)
firebase firestore:rules validate --project indii-music-founder
```

If any check fails, fix the error and re-run. Apply the **Two-Strike Rule**: if a fix fails twice, stop, log extensively, and propose an alternative approach.

---

## Phase 4: Output

### HUNT Mode (fix + commit)

1. **Commit all fixes:**
   ```bash
   git add <hunter-task-files> && git commit -m "fix(hunter): [summary of all fixes applied]" && git push origin HEAD:main
   ```

2. **Update Error Ledger** (`.agent/skills/error_memory/ERROR_LEDGER.md`):
   ```
   ## [DATE] Hunter Session
   - SEVERITY: [Critical|High|Medium|Low]
   - FILE: [path]
   - BUG: [description]
   - FIX: [what was changed]
   ```

3. **Update mem0:**
   ```
   mcp_mem0_add-memory(
     content="ERROR: [pattern] | FIX: [solution] | FILE: [file]",
     userId="indii-errors"
   )
   ```

### AUDIT Mode (find-only + handoff)

1. **Open issues ledger** (`.agent/test_ledger/OPEN_ISSUES.md`):
   - This is the source of truth for every confirmed finding.
   - Add one issue block per finding using the existing ledger style: status, severity, module, location, summary, expected acceptance, honest fallback when relevant, fix direction, and DO NOT guardrail.
   - Before adding a new issue, search for duplicates by feature, file path, and failure mode.

2. **Supporting findings doc** (`.agent/test_ledger/HUNT_AUDIT_<timestamp>.md`):
   - Keep concise evidence, command results, and false leads only.
   - Cross-reference the `OPEN_ISSUES.md` issue ID for each confirmed finding.
   - Do not treat this file as the canonical fix queue.

3. **GitHub issues** (label `triage/ready-for-agent`):
   - One issue per Critical/High finding
   - Body = finding block + fix direction + acceptance criteria
   - Cross-link to the `OPEN_ISSUES.md` issue ID and supporting findings doc

4. **Report:**
   ```
   ✅ AUDIT COMPLETE
   - Ledger: .agent/test_ledger/OPEN_ISSUES.md
   - Evidence: .agent/test_ledger/HUNT_AUDIT_<timestamp>.md
   - Issues: #<issue>, #<issue>, ... (highest severity)
   - Hand off — do not commit, push, or modify code
   ```

Do NOT commit, push, or log to Error Ledger/mem0 in AUDIT mode. The fixing agent owns that.

---

## IMPORTANT: Mode-Specific Rules

### HUNT Mode (autonomous fix-all)

1. **DO NOT ASK** before fixing a bug. If you found it, fix it.
2. **DO NOT REPORT AND WAIT.** The output of this workflow is committed code, not a list of issues.
3. **Every finding gets a fix.** If a fix is non-trivial (> 50 lines), apply the simplest safe fix and add a `// TODO(hunter): deeper refactor needed` comment.
4. **Verify after fixing.** Never commit code that doesn't pass typecheck and tests.
5. **Log everything.** Every fix goes to Error Ledger AND mem0 for institutional memory.
6. **Check deployed state.** If a bug involves configuration (API keys, env vars), verify the production deployment matches local config.
7. **The Ponytail Rule.** Apply the simplest, most minimal fix possible. If a native platform feature or stdlib can do it, use it instead of writing custom logic.

### AUDIT Mode (find-only)

1. **DO NOT FIX.** Document only.
2. **DO NOT COMMIT.** Hand off `OPEN_ISSUES.md`, the supporting findings doc, and GitHub issues to the fixing agent.
3. **DO NOT LOG to Error Ledger / mem0.** The fixing agent owns the record-keeping after they fix.
4. **Every finding gets characterized.** Severity, evidence, files, fix direction, verified-or-recon.
5. **Every confirmed finding goes in `OPEN_ISSUES.md`.** The audit doc is supporting evidence only, not the source of truth.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
