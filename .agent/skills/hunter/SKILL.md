---
name: hunter
description: Systematic HTTP error code hunter for indiiOS. Identifies and patches latent 401, 403, 404, 410, 413, 422, 429, 500, 502, 503, 504 vulnerabilities across Firestore rules, Cloud Functions, service layers, and third-party API clients.
---

# @hunter — HTTP Error Code Hunter

## Mission

Perform a structured sweep of the entire indiiOS codebase to identify and fix any code path that could produce, swallow, or fail to handle the following HTTP/Firebase error codes:

| Code | Name | Common Cause |
|------|------|-------------|
| 401 | Unauthorized | Missing or expired auth token |
| 403 | Forbidden | Firestore rules gap, ragProxy blocked path, bad API key scope |
| 404 | Not Found | Missing Storage asset, dead endpoint, wrong Firestore path |
| 410 | Gone | Deprecated endpoints still being called |
| 413 | Payload Too Large | Image/file uploads exceeding provider limits |
| 422 | Unprocessable Entity | Validation mismatch between client payload and server schema |
| 429 | Too Many Requests | Missing retry/backoff logic on API clients |
| 500 | Internal Server Error | Unhandled exceptions in Cloud Functions |
| 502 | Bad Gateway | Proxy/upstream failure (Inngest, Agent Zero, external APIs) |
| 503 | Service Unavailable | Transient outage, missing retry logic |
| 504 | Gateway Timeout | Functions timeout, missing timeout handling |

---

## Wave 1 — Live Browser Sweep

1. Open the live app at `https://indiios-studio.web.app`
2. Open DevTools → Console + Network tabs, filter by `4`, `5` status codes
3. Navigate through every major module:
   - Dashboard, Creative Studio, Video, Social, Finance, Marketing
   - Distribution, Brand Manager, Legal, Merch Tool, Knowledge Base
4. Screenshot and log every non-200 response with full URL, status, and payload

```bash
# Check Cloud Functions logs for recent errors
firebase functions:log --project indiios-v-1-1 --limit 100 | grep -E "403|401|404|429|500|502|503|504"
```

---

## Wave 2 — Firestore Rules Audit

**Goal:** Find every collection path used in service code that lacks a matching rule.

```bash
# Step 1: Extract all collection paths from services
grep -rn "collection(db, '" src/services/ --include="*.ts" | \
  grep -v "test\|mock\|Mock" | \
  sed "s/.*collection(db, '//;s/').*//" | sort -u

# Step 2: Extract all collection paths from firestore.rules  
grep -n "match /" firestore.rules | sed "s/.*match \///;s/ {.*//" | sort -u

# Step 3: Compare — anything in Step 1 not in Step 2 is a latent 403
```

For each missing collection, add a rule following this pattern:

```javascript
// User-scoped collection (user owns their documents)
match /collection_name/{docId} {
  allow read, write: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
}

// Admin-write / auth-read (e.g. content_rules)
match /collection_name/{docId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}
```

Then validate and deploy:

```bash
firebase firestore:rules firebase validate --project indiios-v-1-1
firebase deploy --only firestore:rules --project indiios-v-1-1
```

---

## Wave 3 — Service HTTP Client Audit

**Goal:** Find every raw `fetch()` call that lacks auth headers or proper error handling.

```bash
# Find raw fetch() calls that might be missing auth token
grep -rn "fetch(" src/services/ --include="*.ts" | \
  grep -v "test\|mock\|import\|await import" | \
  grep "fetch('" | head -50
```

**Check each HTTP client for:**

- [ ] `Authorization: Bearer <idToken>` on every request to protected endpoints
- [ ] Retry logic for 429 and 5xx with exponential backoff
- [ ] Status-specific error messages (not just generic `throw new Error(response.statusText)`)
- [ ] Special handling for 413 (payload too large) and 422 (validation mismatch)

**Retry pattern to apply:**

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

## Wave 4 — Cloud Functions Endpoint Audit

**Goal:** Every `onRequest` handler must have auth verification. Every `onCall` must have `if (!context.auth)` guard.

```bash
# Find all Cloud Functions exports
grep -n "onRequest\|onCall" functions/src/index.ts | head -60

# Check each onRequest for auth token verification pattern
grep -A 15 "onRequest" functions/src/index.ts | grep -E "verifyIdToken|401|403|Unauthorized"
```

**Check ragProxy allowedPrefixes for any new Gemini API paths:**

```bash
grep -A 10 "allowedPrefixes" functions/src/index.ts
```

**Ensure Express body size limits are set for onRequest handlers:**

```typescript
app.use(express.json({ limit: '10mb' })); // Prevents 413 from upstream
```

---

## Wave 5 — Deep Code Grep

Full pattern sweep across all services:

```bash
# Find unhandled response codes (flat generic error handlers)
grep -rn "!response.ok" src/services/ --include="*.ts" | \
  grep -v "status\|429\|502\|503\|504\|401\|403\|404" | \
  grep -v test

# Find missing 404 handlers for Firestore reads
grep -rn "getDoc\|getDocs" src/services/ --include="*.ts" | \
  grep -v "test\|mock" | \
  grep -v "\.exists\|if.*doc\|null\|undefined" | head -30

# Spot any hardcoded deprecated API endpoints (410 Gone candidates)
grep -rn "v1beta\|v1alpha\|deprecated\|legacy" src/services/ --include="*.ts" | \
  grep -v "test\|//\|mock" | head -30

# Find functions without timeout guards
grep -rn "async.*callApi\|async.*request\|async.*fetch" src/services/ --include="*.ts" | \
  grep -v "AbortController\|setTimeout\|timeoutMs\|signal" | head -20
```

---

## Deployment & Commit Protocol

After each wave of fixes:

```bash
# 1. Validate rules
firebase firestore:rules validate --project indiios-v-1-1

# 2. Deploy rules immediately
firebase deploy --only firestore:rules --project indiios-v-1-1

# 3. Deploy affected functions
firebase deploy --only functions:ragProxy,functions:generateContentStream --project indiios-v-1-1

# 4. Commit with descriptive message per fix
git add <files>
git commit -m "fix(<scope>): <what was broken> → <what was fixed>

Affected error code: [401|403|404|413|422|429|5xx]
Found during: HTTP Error Code Hunter sweep
Impact: <describe what would have happened without this fix>"

git push
```

---

## Known Patterns Found in This Codebase

From the 2026-02-21 Hunter session — these exact patterns were caught and fixed:

| Fix | File | Error Code | Root Cause |
|-----|------|-----------|-----------|
| Firestore rules | `firestore.rules` | 403 | 7 collections missing rules: `fraud_alerts`, `content_rules`, `manufacture_requests`, `sample_requests`, `mockup_generations`, `proactive_tasks`, `users/{uid}/contracts` |
| ragProxy allowlist | `functions/src/index.ts` | 403 | `/v1beta/fileSearchStores` and `/v1beta/operations` blocked by path allowlist |
| streamQuery auth | `src/services/rag/GeminiRetrievalService.ts` | 403 | Raw `fetch()` to ragProxy without `Authorization: Bearer` header |
| Printful retry | `src/services/pod/PrintOnDemandService.ts` | 429/413/422/5xx | Flat `throw new Error()` with no status distinction or retry logic |

---

## Error Memory

After each Hunter session, log new findings to the Error Ledger:

```bash
# Add to .agent/skills/error_memory/ERROR_LEDGER.md
echo "## [DATE] Hunter Find
- CODE: [status code]
- FILE: [path]  
- CAUSE: [root cause]
- FIX: [what was changed]" >> .agent/skills/error_memory/ERROR_LEDGER.md
```

And to mem0:

```
mcp_mem0_add-memory(
  content="ERROR: [pattern] | FIX: [solution] | FILE: [file]",
  userId="indiiOS-errors"
)
```
