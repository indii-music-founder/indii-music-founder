---
description: Systematic HTTP error code hunter — finds and fixes 401, 403, 404, 410, 413, 422, 429, 500, 502, 503, 504 vulnerabilities across the entire indiiOS stack
---

# /hunter — HTTP Error Code Hunter

## Prerequisites

Read the full skill before starting:

```
.agent/skills/hunter/SKILL.md
```

## Execution Steps

1. **Activate Hunter persona**
   - You are now the 403 Hunter. Your mission: zero tolerance for unhandled or incorrectly-handled HTTP errors across the full stack.
   - Target codes: **401, 403, 404, 410, 413, 422, 429, 500, 502, 503, 504**

// turbo
2. **Wave 1 — Live browser sweep**

- Open DevTools on `https://indiios-studio.web.app`
- Navigate all major modules, capture all non-200 responses

1. **Wave 2 — Firestore rules audit**

   ```bash
   grep -rn "collection(db, '" src/services/ --include="*.ts" | grep -v "test\|mock" | sed "s/.*collection(db, '//;s/').*//" | sort -u > /tmp/service_collections.txt
   grep -n "match /" firestore.rules | sed "s/.*match \///;s/ {.*//" | sort -u > /tmp/rules_collections.txt
   diff /tmp/service_collections.txt /tmp/rules_collections.txt
   ```

2. **Wave 3 — Service HTTP client audit**

   ```bash
   grep -rn "!response.ok" src/services/ --include="*.ts" | grep -v "status\|429\|5[0-9][0-9]" | grep -v test
   ```

3. **Wave 4 — Cloud Functions endpoint audit**

   ```bash
   grep -n "onRequest\|onCall" functions/src/index.ts
   grep -A 10 "allowedPrefixes" functions/src/index.ts
   ```

4. **Wave 5 — Deep grep sweep**

   ```bash
   grep -rn "fetch('" src/services/ --include="*.ts" | grep -v "test\|mock\|await import" | grep -v "Authorization" | head -30
   ```

5. **Fix all findings** — Apply fixes per the patterns in `SKILL.md`

6. **Deploy**

   ```bash
   firebase deploy --only firestore:rules --project indiios-v-1-1
   firebase deploy --only functions --project indiios-v-1-1
   ```

7. **Commit**

   ```bash
   git add -A && git commit -m "fix(hunter): [summary of all fixes]" && git push
   ```

8. **Update Error Ledger** — Log all new findings to `.agent/skills/error_memory/ERROR_LEDGER.md` and mem0
