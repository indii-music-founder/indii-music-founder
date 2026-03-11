---
name: hunter
description: Full-spectrum codebase bug hunter for indiiOS. Surfaces security vulnerabilities, data integrity issues, race conditions, memory leaks, and correctness bugs across the entire stack. Covers both Big Game (surface-level grep scans) and Small Game (deep logic reads). Fully autonomous — finds AND fixes all issues, then verifies and commits.
---

# @hunter — Full-Spectrum Bug Hunter

## Mission

Perform a structured, multi-phase sweep of the entire indiiOS codebase to **find AND fix** every category of bug that could impact production stability, security, or data integrity. This is not limited to HTTP errors — it covers XSS, race conditions, subscription leaks, stale closures, floating-point money math, locale traps, and more.

> **AUTONOMY RULES:**
> 1. **DO NOT ASK** before fixing a bug. If you found it, fix it.
> 2. **DO NOT REPORT AND WAIT.** The output of this skill is committed code, not a list of issues.
> 3. **Every finding gets a fix.** If a fix is non-trivial (> 50 lines), apply the simplest safe fix and add a `// TODO(hunter): deeper refactor needed` comment.
> 4. **Verify after fixing.** Never commit code that doesn't pass typecheck and tests.
> 5. **Log everything.** Every fix goes to Error Ledger AND mem0 for institutional memory.

---

## Severity Tiers

| Tier | Criteria | Action |
|------|----------|--------|
| 🚨 Critical | Security vulnerability, data loss, crash | Fix NOW |
| ⚠️ High | User-visible broken behavior | Fix before launch |
| 🔶 Medium | Intermittent/locale-dependent bugs | Fix this sprint |
| 🔵 Low | Code hygiene, future footguns | Log & schedule |
| ✅ Clean | Verified safe | Document as clean |

---

## Phase 1: Big Game (Surface Scan)

Fast grep-based scans that catch low-hanging fruit. Run all in parallel.

### 1.1 Security Vectors

```bash
# XSS: dangerouslySetInnerHTML
grep -rn 'dangerouslySetInnerHTML' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Hardcoded secrets
grep -rn 'sk_live\|sk_test\|ghp_\|AIza' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'MOCK_KEY' | grep -v 'import.meta.env'

# process.env in browser context (should be import.meta.env in Vite)
grep -rn 'process\.env\.' src/ --include='*.ts' --include='*.tsx' | grep -v 'VITEST\|NODE_ENV\|import\.meta' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

### 1.2 Memory Leaks

```bash
# Event listener mismatch (add vs remove counts)
echo "=== addEventListener ===" && grep -rn 'addEventListener' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "=== removeEventListener ===" && grep -rn 'removeEventListener' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l

# Timers without cleanup
grep -rn 'setInterval\|setTimeout' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v 'clearInterval\|clearTimeout' | wc -l

# Firestore onSnapshot without matching unsubscribe
grep -rn 'onSnapshot' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

### 1.3 Loading State Traps

Bugs where a loading gate (`if (loading) return <Spinner>`) has no timeout or error fallback,
causing the app to hang forever when the underlying service fails silently (blocked API key,
network down, SDK crash, CI/CD env var mismatch).

```bash
# Loading gates that block ALL rendering with no timeout/fallback
grep -rn 'if.*Loading.*return' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Init functions that set loading=true — check each has a timeout or error path
grep -rn 'authLoading\|isLoading.*true\|loading: true' src/core/store/slices/ --include='*.ts' | grep -v '.test.'

# CI/CD env var mismatch: deployed key must match local .env
grep 'VITE_FIREBASE_API_KEY' .env
# Cross-reference with: GitHub Settings → Secrets → VITE_FIREBASE_API_KEY
```

**Deep Read Checklist:**
- [ ] Every loading gate must have a timeout failsafe (max 10-15s)
- [ ] Every `onAuthStateChanged` / service init must set `loading: false` in ALL paths (success, error, AND timeout)
- [ ] CI/CD secrets must match local `.env` values for critical config (API keys, project IDs)
- [ ] External service initialization must have `try/catch` around it

### 1.4 Swallowed Errors & Code Hygiene

```bash
# Empty catch blocks (silent failure)
grep -rn 'catch.*{}' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# TODO/FIXME/HACK markers (unfinished work)
grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'

# Raw console.log (should use logger)
grep -rn 'console\.log' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v '//'

# Type-safety: as any casts
grep -rn 'as any' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
```

### 1.5 HTTP Error Code Sweep

Target codes: **401, 403, 404, 410, 413, 422, 429, 500, 502, 503, 504**

```bash
# Unhandled response codes (flat generic error handlers)
grep -rn '!response.ok' src/services/ --include='*.ts' | grep -v 'status\|429\|502\|503\|504\|401\|403\|404' | grep -v test

# Missing 404 handlers for Firestore reads
grep -rn 'getDoc\|getDocs' src/services/ --include='*.ts' | grep -v 'test\|mock' | grep -v '\.exists\|if.*doc\|null\|undefined' | head -30

# Functions without timeout guards
grep -rn 'await fetch(' src/services/ --include='*.ts' -r | grep -v 'signal\|timeout\|abort' | grep -v '.test.'

# Deprecated API endpoints (410 candidates)
grep -rn 'v1beta\|v1alpha\|deprecated\|legacy' src/services/ --include='*.ts' | grep -v 'test\|//\|mock' | head -30
```

### 1.6 Vendor Chunk Conflicts (Vite/Webpack)

React-dependent libraries MUST share the same React instance. Splitting them into
separate vendor chunks causes `unstable_now`, `__SECRET_INTERNALS`, or reconciler
crashes that kill the entire bundle at import time — before any error boundary fires.

```bash
# Check manualChunks for React-dependent libs isolated from vendor-react
grep -A 30 'manualChunks' vite.config.ts

# Cross-reference: which packages depend on react-reconciler or scheduler?
# Any of these MUST be in vendor-react or left out of manualChunks entirely:
# @react-three/fiber, @react-three/drei, @remotion/*, react-spring, @dnd-kit/*
grep -rn 'react-reconciler\|scheduler' node_modules/@react-three/fiber/package.json node_modules/remotion/package.json 2>/dev/null
```

**Deep Read Checklist:**
- [ ] Every entry in `manualChunks` must NOT contain packages that import `react-reconciler`, `scheduler`, or `react-dom/client`
- [ ] If `@react-three/fiber`, `@remotion/*`, or `react-spring` appear in a separate chunk, they MUST move to `vendor-react`
- [ ] After any manualChunks change, run `npm run build:studio` and test the production bundle loads

**Reference Incident:** 2026-03-11 — `@react-three/fiber` in `vendor-three` chunk caused
`TypeError: Cannot set properties of undefined (setting 'unstable_now')`, killing the
entire production app before React mounted.

### 1.7 Impure Render Functions

`Math.random()`, `Date.now()`, `crypto.getRandomValues()` in JSX render bodies violate
React's purity rules. ESLint `react-hooks/purity` catches these as *errors* that block CI/CD.

```bash
# Math.random() in render (blocks lint, non-deterministic)
grep -rn 'Math\.random()' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | grep -v 'useMemo\|useCallback\|useRef'

# Date.now() in render
grep -rn 'Date\.now()' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'useMemo\|useCallback\|useRef\|useEffect'

# crypto in render
grep -rn 'crypto\.\(getRandomValues\|randomUUID\)' src/ --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v 'useMemo\|useCallback\|useRef'
```

**AUTO-FIX:**
- `Math.random()` in render → Replace with deterministic seeded PRNG (see `Particles` component in `BannerAnimations.tsx`) or frame-based `(frame * 137.508) % 360`
- `Date.now()` in render → Move to `useEffect` or `useMemo`
- `crypto.*` in render → Move to `useMemo` with stable deps

**Reference Incident:** 2026-03-11 — `Math.random()` in `BannerGlitch` render caused
`react-hooks/purity` lint error, blocking CI/CD deploy of critical production fix.

---

## Phase 2: Small Game (Deep Logic Read)

These require reading actual code *line-by-line*, not grep patterns.

### 2.1 Zustand Store Slices

Read every file in `src/core/store/slices/`:

- [ ] **Subscription leaks:** Does every `onSnapshot` / `subscribe` store its unsubscribe via `registerSubscription()`?
- [ ] **Stale flags:** After async operations, are ALL loading/connecting flags reset on BOTH success AND error paths?
- [ ] **Non-serializable state:** Are callbacks/Promises/functions stored in state? (Breaks persist/devtools)
- [ ] **Selector instability:** Any multi-property destructuring from `useStore()` without `useShallow`?

```bash
# Quick: count useShallow vs useStore to find unguarded selectors
echo "useShallow:" && grep -rn 'useShallow' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
echo "useStore:" && grep -rn 'useStore(' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive' | wc -l
```

### 2.2 Finance & Revenue

Read `src/services/finance/` and `execution/finance/`:

- [ ] **Floating-point money:** Any arithmetic on dollar amounts without converting to integer cents first?
- [ ] **Division by zero:** Percentage calculations that divide by a value that could be 0?
- [ ] **Rounding errors:** `toFixed()` without `Math.round()` first?

```bash
grep -rn 'toFixed\|Math.round' src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

### 2.3 Race Conditions & Concurrency

Read any file that does Firestore read-modify-write:

- [ ] **Non-atomic array updates:** Read doc → mutate array in memory → write entire array back? (Classic race condition)
- [ ] **Missing Firestore transactions:** Any multi-document update that should be atomic but isn't?
- [ ] **Concurrent Inngest functions:** Are functions with `concurrency > 1` writing to the same document?

```bash
# Find read-modify-write patterns (get → update on same ref)
grep -rn 'timelineRef.update\|docRef.update\|\.update({' functions/src/ --include='*.ts' | grep -v 'transaction\.'
```

### 2.4 Distribution & DDEX

Read `src/services/distribution/` and `src/services/identity/`:

- [ ] **ISRC/UPC collisions:** Can two concurrent calls generate the same identifier? (Must use Firestore transactions)
- [ ] **Sequence overflow:** At what number does the identifier format break? Document the ceiling.
- [ ] **Date locale traps:** Are DDEX XML dates formatted with explicit locale or `toISOString()`?

### 2.5 AI & Agent Services

Read `src/services/agent/BaseAgent.ts` and specialist agents:

- [ ] **Token exhaustion:** Which Gemini calls are missing `maxOutputTokens`? (Unbounded = budget blowout)
- [ ] **Thought signature continuity:** Is `thoughtSignature` captured and passed back in follow-up calls?
- [ ] **Abort propagation:** Is the `AbortSignal` threaded through the entire call chain?

```bash
grep -rn 'maxOutputTokens\|max_tokens' src/services/ --include='*.ts' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

### 2.6 Locale & i18n

```bash
# Locale-dependent formatting without explicit locale
grep -rn 'toLocaleDateString\|toLocaleString\|toLocaleTimeString' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.' | grep -v '_archive'
```

- [ ] Any use in business-critical paths (DDEX, invoices, legal)?
- [ ] Are money amounts formatted with `Intl.NumberFormat` and explicit currency?

### 2.7 Firestore Rules Audit

```bash
# Step 1: Extract all collection paths from services
grep -rn "collection(db, '" src/services/ --include="*.ts" | grep -v "test\|mock\|Mock" | sed "s/.*collection(db, '//;s/').*//g" | sort -u

# Step 2: Extract all collection paths from firestore.rules
grep -n "match /" firestore.rules | sed "s/.*match \///;s/ {.*//g" | sort -u

# Step 3: Compare — anything in Step 1 not in Step 2 is a latent 403
```

---

## Phase 3: Fix & Verify

### Fix Priority Order
1. Fix all 🚨 Critical issues immediately
2. Fix all ⚠️ High issues before committing
3. Log 🔶 Medium and 🔵 Low to Error Ledger for follow-up

### Verification

```bash
# Frontend
npm run typecheck 2>&1 | tail -20
npx vitest run 2>&1 | tail -30
npm run build:studio 2>&1 | tail -20

# Cloud Functions (if modified)
cd functions && npx tsc --noEmit 2>&1 | tail -20

# Firestore rules (if modified)
firebase firestore:rules validate --project indiios-v-1-1
```

### Commit

```bash
git add -A && git commit -m "fix(hunter): [summary of all fixes]" && git push origin main
```

---

## Phase 4: Error Memory Protocol

After every hunt session, persist findings:

### Error Ledger

```bash
echo "## [DATE] Hunter Find
- SEVERITY: [Critical|High|Medium|Low]
- FILE: [path]
- BUG: [description]
- FIX: [what was changed]" >> .agent/skills/error_memory/ERROR_LEDGER.md
```

### mem0

```
mcp_mem0_add-memory(
  content="ERROR: [pattern] | FIX: [solution] | FILE: [file]",
  userId="indiiOS-errors"
)
```

---

## Reference: Proven Fix Patterns

### XSS via dangerouslySetInnerHTML
```typescript
// BAD: raw HTML injection
<div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />

// GOOD: CSS handles line breaks, no HTML parsing
<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>

// ALTERNATIVE: sanitize if HTML is required
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
```

### Non-Atomic Firestore Array Update (Race Condition)
```typescript
// BAD: read-modify-write without locking
const snap = await ref.get();
const arr = snap.data()!.items;
arr[idx].status = 'done';
await ref.update({ items: arr }); // Another function may overwrite this!

// GOOD: atomic transaction
await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const arr = snap.data()!.items;
    arr[idx].status = 'done';
    tx.update(ref, { items: arr }); // Retries if doc changed
});
```

### Subscription Leak in Zustand
```typescript
// BAD: unsubscribe never stored
const unsubscribe = service.subscribe(callback);
// ... unsubscribe is never called → Firestore listener leaks

// GOOD: register with subscription manager
const unsubscribe = service.subscribe(callback);
useStore.getState().registerSubscription('my-sub-id', unsubscribe);
```

### Stale Loading Flag
```typescript
// BAD: flag not reset on success
set({ isConnecting: true });
await connect(); // success path forgets to reset
// catch: set({ isConnecting: false }); // only error resets it

// GOOD: reset on both paths
try {
    set({ isConnecting: true });
    await connect();
    set({ isConnecting: false }); // ← reset on success too
} catch {
    set({ isConnecting: false });
}
```

### HTTP Retry Pattern
```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        const response = await fetch(endpoint, options);

        if (!response.ok) {
            const { status } = response;
            const body = await response.json().catch(() => ({ message: response.statusText }));
            const message = body?.error?.message || body?.message || response.statusText;

            // Transient — retry with exponential backoff
            if (status === 429 || status === 502 || status === 503 || status === 504) {
                attempt++;
                if (attempt >= maxRetries) throw new Error(`[${status}] after ${maxRetries} retries: ${message}`);
                const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
                console.warn(`[${status}] Retrying in ${waitMs}ms...`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }

            // Non-retryable — descriptive messages
            if (status === 401) throw new Error(`Auth error (401): ${message}`);
            if (status === 403) throw new Error(`Forbidden (403): ${message}. Check API key scope.`);
            if (status === 404) throw new Error(`Not found (404): ${endpoint}`);
            if (status === 413) throw new Error(`Payload too large (413): Reduce file size.`);
            if (status === 422) throw new Error(`Validation error (422): ${message}`);

            throw new Error(`API error (${status}): ${message}`);
        }

        return response.json();
    }
    throw new Error('Request failed after retries');
}
```

---

## Known Patterns Found in This Codebase

| Session | Fix | File | Category |
|---------|-----|------|----------|
| 2026-02-21 | Firestore rules for 7 missing collections | `firestore.rules` | HTTP 403 |
| 2026-02-21 | ragProxy allowlist paths | `functions/src/index.ts` | HTTP 403 |
| 2026-02-21 | streamQuery auth header | `GeminiRetrievalService.ts` | HTTP 403 |
| 2026-02-21 | Printful retry logic | `PrintOnDemandService.ts` | HTTP 429/5xx |
| 2026-03-11 | Race condition: non-atomic milestone update | `milestone_execution.ts` | Race Condition |
| 2026-03-11 | Race condition: poller vs executor writes | `pollTimelineMilestones.ts` | Race Condition |
| 2026-03-11 | XSS via dangerouslySetInnerHTML | `WorkspaceCanvas.tsx` | Security |
| 2026-03-11 | Subscription leak in finance slice | `financeSlice.ts` | Memory Leak |
| 2026-03-11 | isConnecting flag never resets on success | `distributionSlice.ts` | Stale UI |
| 2026-03-11 | Photo capture silently discards data | `QuickCapture.tsx` | Data Loss |
| 2026-03-11 | AI calls missing maxOutputTokens | Multiple agent services | Token Exhaustion |
| 2026-03-11 | Locale-dependent formatting (15+ uses) | Multiple modules | i18n |
| 2026-03-11 | Auth init hangs forever (no timeout failsafe) | `authSlice.ts` | Loading Trap |
| 2026-03-11 | CI/CD deploys with wrong API key (Maps-only) | GitHub Actions secret | Config Mismatch |

---

## Reference: Loading State Trap Fix

```typescript
// BAD: loading gate with no timeout — hangs forever if service fails silently
initializeAuthListener: () => {
    return onAuthStateChanged(auth, (user) => {
        set({ user, authLoading: false });
    });
    // If onAuthStateChanged never fires (blocked API key, network down),
    // authLoading stays true → app stuck on <LoadingFallback /> forever
}

// GOOD: timeout failsafe forces fallthrough after 10s
initializeAuthListener: () => {
    let hasResolved = false;
    const timeoutId = setTimeout(() => {
        if (!hasResolved) {
            logger.error('[Auth] Timed out after 10s');
            set({ authLoading: false, authError: 'Service unavailable. Try again.' });
        }
    }, 10_000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
        hasResolved = true;
        clearTimeout(timeoutId);
        set({ user, authLoading: false });
    });

    return () => { clearTimeout(timeoutId); unsubscribe(); };
}
```
