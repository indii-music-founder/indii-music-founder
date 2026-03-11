---
description: Full-spectrum codebase bug hunter — surfaces security, data integrity, performance, and correctness issues across the entire indiiOS stack. Covers both Big Game (surface-level) and Small Game (subtle) bugs. Fully autonomous — finds AND fixes all issues, then verifies and commits.
---

# /hunter — Full-Spectrum Bug Hunter

> **PERSONA:** You are the Hunter. Your mission: find every bug that could surface randomly in production — from XSS to stale closures to floating-point rounding in royalty splits. You do NOT stop at reporting. **You FIX every issue you find, then verify and commit.**

// turbo-all

## Phase 1: Big Game (Surface Scan)

Run all scans in parallel. These catch low-hanging fruit fast.

### 1.1 Security Vectors
```bash
# XSS: dangerouslySetInnerHTML
grep -rn 'dangerouslySetInnerHTML' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Hardcoded secrets
grep -rn 'sk_live\|sk_test\|ghp_\|AIza' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'MOCK_KEY' | grep -v 'import.meta.env'

# process.env in browser context (should be import.meta.env)
grep -rn 'process\.env\.' src/ --include='*.ts' --include='*.tsx' | grep -v 'VITEST\|NODE_ENV\|import\.meta' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- `dangerouslySetInnerHTML` → Replace with `<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>` or add DOMPurify sanitization
- Hardcoded secrets → Extract to `.env` using `SERVICE_FEATURE_KEY` naming, replace with `import.meta.env.VITE_*`
- `process.env` in browser → Replace with `import.meta.env.VITE_*`

### 1.2 Memory Leaks
```bash
# Event listener mismatch (add vs remove counts)
echo "=== addEventListener ===" && grep -rn 'addEventListener' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "=== removeEventListener ===" && grep -rn 'removeEventListener' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l

# Firestore onSnapshot without matching unsubscribe
grep -rn 'onSnapshot' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- Missing `removeEventListener` → Add cleanup in `useEffect` return or component unmount
- Leaked `onSnapshot` → Store unsubscribe via `registerSubscription()` or return it from `useEffect`

### 1.3 Swallowed Errors
```bash
# Empty catch blocks (silent failure)
grep -rn 'catch.*{}' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Raw console.log (should use logger)
grep -rn 'console\.log' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v '//'
```

**AUTO-FIX:** For each finding:
- Empty catch → Add `logger.error()` and `Sentry.captureException()` 
- Raw `console.log` → Replace with `logger.debug()` or `logger.info()`

### 1.4 HTTP Error Codes
```bash
# Unhandled response codes
grep -rn '!response.ok' src/services/ --include='*.ts' | grep -v 'status\|429\|502\|503' | grep -v test

# Fetch without timeout
grep -n 'await fetch(' src/services/ --include='*.ts' -r | grep -v 'signal\|timeout\|abort' | grep -v '.test.'
```

**AUTO-FIX:** For each finding:
- Missing status handling → Add status-specific error messages per the retry pattern in SKILL.md
- Missing timeout → Add `signal: AbortSignal.timeout(10000)` to fetch options

---

## Phase 2: Small Game (Deep Logic Read)

Read actual code line-by-line. For each file, apply fixes immediately.

### 2.1 Store & State (Zustand Slices)

Read every slice in `src/core/store/slices/`:

**SCAN FOR:**
- Subscription leaks (onSnapshot without registerSubscription)
- Stale flags (loading/connecting not reset on both success AND error paths)
- Non-serializable state (callbacks/Promises stored in state)
- Selector instability (multi-property useStore without useShallow)

```bash
echo "useShallow:" && grep -rn 'useShallow' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "useStore:" && grep -rn 'useStore(' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
```

**AUTO-FIX:** For each finding:
- Subscription leak → Add `registerSubscription('descriptive-id', unsubscribe)` call
- Stale flag → Add `set({ flagName: false })` to success path
- Non-serializable → Move callbacks to a `Map` outside of Zustand state
- Missing `useShallow` → Wrap selector in `useShallow()`

### 2.2 Race Conditions

Read any file that does Firestore read-modify-write, especially in `functions/src/`:

```bash
grep -rn '\.update({' functions/src/ --include='*.ts' | grep -v 'transaction\.'
```

**AUTO-FIX:** For each finding:
- Non-atomic array update → Wrap in `db.runTransaction(async (tx) => { ... })`
- Always re-read the doc inside the transaction via `tx.get(ref)`
- Only modify the specific array element, never overwrite blindly

### 2.3 Finance & Revenue

```bash
grep -rn 'toFixed\|Math.round' src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding:
- Floating-point money → Convert to integer cents: `Math.round(amount * 100)` before operations
- Division by zero → Add guard: `denominator > 0 ? numerator / denominator : 0`

### 2.4 AI & Agent Services

```bash
grep -rn 'maxOutputTokens\|max_tokens' src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each Gemini call missing `maxOutputTokens`:
- Add `maxOutputTokens: 4096` (or appropriate limit for the use case)
- Agent chat: 4096, Summary: 512, Quick tasks: 1024

### 2.5 Locale & i18n

```bash
grep -rn 'toLocaleDateString\|toLocaleString\|toLocaleTimeString' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

**AUTO-FIX:** For each finding in business-critical paths (DDEX, invoices, legal):
- Add explicit locale: `.toLocaleDateString('en-US', { ... })`
- For DDEX/ISO dates: use `.toISOString()` instead

---

## Phase 3: Verify

After ALL fixes are applied, run the full verification gauntlet:

```bash
# Frontend
npm run typecheck 2>&1 | tail -30
npx vitest run 2>&1 | tail -30
npm run build:studio 2>&1 | tail -20

# Cloud Functions (if modified)
cd functions && npx tsc --noEmit 2>&1 | tail -20 && cd ..

# Firestore rules (if modified)
firebase firestore:rules validate --project indiios-v-1-1
```

If any check fails, fix the error and re-run. Apply the **Two-Strike Rule**: if a fix fails twice, stop, log extensively, and propose an alternative approach.

---

## Phase 4: Commit & Log

### Commit all fixes
```bash
git add -A && git commit -m "fix(hunter): [summary of all fixes applied]" && git push origin main
```

### Update Error Ledger
Add ALL findings to `.agent/skills/error_memory/ERROR_LEDGER.md`:
```
## [DATE] Hunter Session
- SEVERITY: [Critical|High|Medium|Low]
- FILE: [path]
- BUG: [description]
- FIX: [what was changed]
```

### Update mem0
```
mcp_mem0_add-memory(
  content="ERROR: [pattern] | FIX: [solution] | FILE: [file]",
  userId="indiiOS-errors"
)
```

---

## IMPORTANT: Autonomy Rules

1. **DO NOT ASK** before fixing a bug. If you found it, fix it.
2. **DO NOT REPORT AND WAIT.** The output of this workflow is committed code, not a list of issues.
3. **Every finding gets a fix.** If a fix is non-trivial (> 50 lines), apply the simplest safe fix and add a `// TODO(hunter): deeper refactor needed` comment.
4. **Verify after fixing.** Never commit code that doesn't pass typecheck and tests.
5. **Log everything.** Every fix goes to Error Ledger AND mem0 for institutional memory.
