# Cloud Functions v2 Migration Guide

**Objective:** Migrate from Firebase Functions v1 to v2 to enable Server-Sent Events (SSE) streaming for Phase 2 agent responses.

**Status:** Phase 2a (Prerequisite for streaming agent features)

---

## Current State

- **Package Version:** firebase-functions 7.0.5 (supports v1 API)
- **API:** `import * as functions from "firebase-functions/v1"`
- **Runtime:** Node.js 18+ (compatible with v2)
- **Express:** Already using Express via Inngest middleware
- **Functions:** 15+ exported functions using v1 API

**Existing Usage Pattern (v1):**
```typescript
export const functionName = functions
  .runWith({ enforceAppCheck: true, secrets: [...], timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    // handler logic
  })
```

---

## v2 Migration Changes

### 1. Imports
**Before (v1):**
```typescript
import * as functions from "firebase-functions/v1";
```

**After (v2):**
```typescript
import * as functions from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
```

### 2. Function Definitions
**Before (v1):**
```typescript
export const inngestApi = functions
  .runWith({ enforceAppCheck: ENFORCE_APP_CHECK, secrets: [...] })
  .https.onRequest(async (req, res) => {
    // handler
  })
```

**After (v2):**
```typescript
export const inngestApi = onRequest(
  {
    enforceAppCheck: ENFORCE_APP_CHECK,
    secrets: [...],
    timeoutSeconds: 540,
    memory: "512MB",
    region: "us-central1"
  },
  async (req, res) => {
    // handler (unchanged)
  }
)
```

### 3. Error Handling
**Before (v1):**
```typescript
throw new functions.https.HttpsError("not-found", "message")
```

**After (v2):**
```typescript
throw new HttpsError("not-found", "message")
// or import HttpsError from "firebase-functions/v2/https"
```

### 4. SSE Support (NEW)
**v2 enables Server-Sent Events:**
```typescript
export const streamAgentResponse = onRequest(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  // Stream tokens as they arrive
  agent.on('token', (token) => {
    res.write(`data: ${JSON.stringify({ token })}\n\n`)
  })
  
  agent.on('complete', () => {
    res.end()
  })
})
```

---

## Migration Checklist

### Step 1: Update Imports (index.ts)
- [ ] Change firebase-functions/v1 → firebase-functions/v2
- [ ] Add: `import { onRequest } from "firebase-functions/v2/https"`
- [ ] Add: `import { HttpsError } from "firebase-functions/v2/https"`

### Step 2: Migrate Function Signatures
- [ ] inngestApi
- [ ] triggerVideoJob
- [ ] executeVideoJob
- [ ] triggerLongFormVideoJob
- [ ] renderVideo
- [ ] generateSpeech
- [ ] generateContentStream
- [ ] ragProxy
- [ ] listGKEClusters

### Step 3: Update Error Handling
- [ ] Replace `functions.https.HttpsError` with `HttpsError`
- [ ] Verify error responses work

### Step 4: Test Build
- [ ] `npm run build` should succeed
- [ ] No TypeScript errors
- [ ] Firebase functions deploy successfully (local test)

### Step 5: Add SSE Example (for Phase 2)
- [ ] Create example streaming function
- [ ] Test with curl/fetch

### Step 6: Commit & Document
- [ ] Commit: "feat: migrate Cloud Functions to v2 for SSE streaming support"
- [ ] Document in .agent/PHASE_PROGRESS.md

---

## Backward Compatibility

**Good news:** v2 is largely backward compatible with v1 logic
- Firestore/Storage operations unchanged
- Admin SDK unchanged
- Express middleware works the same
- Only the Cloud Functions API wrapper changes

**Potential Issues:**
- Deprecated v1 properties/methods need review
- Rate limiting might need re-configuration
- Memory/timeout defaults are different

---

## Timeline

- **Effort:** 1-2 hours
- **Risk Level:** LOW (internal API change only, business logic unchanged)
- **Rollback:** Easy (revert imports and function definitions)

---

## Key Files to Modify

1. `packages/firebase/src/index.ts` - Main function definitions
2. `packages/firebase/src/firebase.json` - May need regional configuration
3. Tests (if any)

---

## SSE Streaming Capability (Post-Migration)

Once v2 is in place:
```typescript
// Phase 2: AgentStreamingService will use this
export const streamAgentResponse = onRequest(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  
  const { input, context } = req.body
  const agent = await initializeAgent(context)
  
  agent.on('token', (token) => {
    res.write(`data: ${JSON.stringify({ token, timestamp: Date.now() })}\n\n`)
  })
  
  await agent.process(input)
  res.end()
})
```

This enables real-time streaming of agent responses back to the frontend.

---

**Next:** Execute migration step by step, test, commit, then proceed with Phase 2 proper.
