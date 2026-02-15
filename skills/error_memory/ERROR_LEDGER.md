# Error Memory Ledger

> **Protocol:** profound-memory
> **Version:** 1.0.0

This ledger tracks solved technical challenges to prevent regression. Before debugging, **ALWAYS** check here first.

## Usage

1. **Search:** Ctrl+F this file for error signatures.
2. **Query:** Use `mcp_mem0_search-memories(query="<error>", userId="indiiOS-errors")`.
3. **Solve:** Apply the documented fix.
4. **Record:** After solving a _new_ unique error, add it here and to mem0.

```javascript
mcp_mem0_add -
  memory(
    (content = "ERROR: <Pattern> | FIX: <Fix Summary> | FILE: <File>"),
    (userId = "indiiOS-errors"),
  );
4. **Record:** After solving a *new* unique error, add it here and to mem0.

```javascript
mcp_mem0_add-memory(
  content="ERROR: <Pattern> | FIX: <Fix Summary> | FILE: <File>",
  userId="indiiOS-errors"
)
```

## Entry Format

- **Header:** `## [ID] [Short Description]`
- **Pattern:** Exact error message or symptom.
- **Stack Signature:** The distinctive part of the stack trace.
- **Context:** Where/when it happens.
- **Root Cause:** Technical explanation.
- **Fix:** Code snippet or steps.
- **Prevention:** How to avoid it.
- **Related Files:** Specific file paths.
- **Meta:** Date Added, Related Errors.

---

## FIRESTORE-001 Runtime errors when accessing nested objects

**Pattern:** Parent object is undefined (e.g., Firestore document missing)
**Context:** Runtime errors when accessing nested objects
**Root Cause:** The parent object is undefined. Common with Firestore data that may not exist yet.
**Fix:**

```typescript
// ❌ Wrong - no safety check
const value = data.nested.field;

// ✅ Correct - optional chaining
const value = data?.nested?.field;

// ✅ Correct - with fallback
const value = data?.nested?.field ?? "default";
```

**Date Added:** 2026-01-23
**Related Errors:** FIRESTORE-001

---

## AUTH-001 User Not Authenticated

**Pattern:** `auth.currentUser is null` / `User is not logged in`
**Stack Signature:** `TypeError: Cannot read properties of null (reading 'uid')`
**Context:** Operations requiring authentication
**Root Cause:** Code runs before Firebase Auth initializes, or user session expired.
**Related Files:** `src/services/auth/AuthService.ts`, `src/components/ProtectedRoute.tsx`
**Context:** Operations requiring authentication
**Root Cause:** Code runs before Firebase Auth initializes, or user session expired.
**Related Files:** `src/services/auth/AuthService.ts`, `src/components/ProtectedRoute.tsx`
**Fix:**

```typescript
// ❌ Wrong - immediate access
const user = auth.currentUser;

// ✅ Correct - wait for auth state
import { onAuthStateChanged } from "firebase/auth";
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
  }
});
```

**Date Added:** 2026-01-23
**Related Errors:** FIRESTORE-001

---

## CLOUDRUN-001 Firebase v2 Functions 401 Unauthorized

**Pattern:** `The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header`
**Context:** Firebase v2 Callable Functions (using `firebase-functions/v2/https`)
**Root Cause:** Firebase v2 functions use Cloud Run under the hood. Unlike v1 functions, they require explicit IAM invoker permissions. If no bindings are set, all requests fail with 401 even when Firebase Auth tokens are properly passed.
**Symptoms in Agent:**

- Agent tool execution hangs indefinitely
- SubscriptionService quota checks never complete
- generate_image tool times out after 300s despite Cloud Function succeeding
  **Fix:**

```bash
# Add allUsers as invoker for each v2 function
gcloud run services add-iam-policy-binding [SERVICE_NAME] \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=[PROJECT_ID]

# Known v2 services requiring this fix:
# getsubscription, getusagestats, trackusage,
# cancelsubscription, createcheckoutsession,
# getcustomerportal, resumesubscription
```

**Prevention:**
When deploying new v2 callable functions:

1. **Option A - Post-deployment IAM binding (current approach):**

   ```bash
   firebase deploy --only functions:[NAME]
   gcloud run services add-iam-policy-binding [NAME] \
     --region=us-central1 --member="allUsers" \
     --role="roles/run.invoker" --project=[PROJECT_ID]
   ```

2. **Option B - Function definition with invoker:**

   ```typescript
   import { onCall } from "firebase-functions/v2/https";
   export const myFunction = onCall(
     { invoker: "public" }, // Allows unauthenticated invocations
     async (request) => {
       /* ... */
     },
   import { onCall } from 'firebase-functions/v2/https';
   export const myFunction = onCall(
     { invoker: 'public' }, // Allows unauthenticated invocations
     async (request) => { /* ... */ }
   );
   ```

When deploying new v2 callable functions, ensure invoker permissions:

```typescript
// In function definition, or deploy with:
// firebase deploy --only functions:[NAME]
// Then run the gcloud IAM command above
```

**Date Added:** 2026-02-05
**Related Errors:** AUTH-001, FIRESTORE-001

---

## REFF-001 ReferenceError Variable Name Mismatch

**Pattern:** `ReferenceError: X is not defined`
**Context:** React components after refactoring or merge conflicts
**Root Cause:** A variable is used in the JSX or logic that hasn't been declared or was renamed in a previous change. In `PromptArea.tsx`, `input` and `attachments` were used instead of `commandBarInput` and `commandBarAttachments`.
**Fix:**

1. Identify the correct variable name in the current scope (e.g., check `useStore` or `useState` hooks).
2. Update all occurrences to the correct name.
3. Clean up any duplicated props that might have been introduced during a bad merge.

**Date Added:** 2026-01-23
**Related Errors:** BUILD-001

---

## HUB_SPOKE-001 Invalid Agent Delegation Pattern

**Pattern:** `Hub-and-spoke violation: X -> Y` / Test fails on `delegate_task` call
**Context:** Agent delegation tests in `AgentArchitecture.test.ts` or any BaseAgent delegation
**Root Cause:** The hub-and-spoke architecture ONLY allows:

- **Hub (generalist) → Any Specialist**: ✅ Valid
- **Specialist → Hub (generalist)**: ✅ Valid
- **Specialist → Specialist**: ❌ BLOCKED

Tests that attempt specialist-to-specialist delegation (e.g., `legal → video`) will fail with hub-and-spoke violation.
**Fix:**

```typescript
// ❌ Wrong - specialist to specialist (BLOCKED)
const result = await delegateFunc({
  targetAgentId: "video", // Another specialist
  task: "...",
});

// ✅ Correct - specialist to hub
const result = await delegateFunc({
  targetAgentId: "generalist", // Hub agent
  task: "...",
});

// ✅ Correct - hub to specialist
const result = await delegateFunc({
  targetAgentId: "legal", // Any specialist is fine from hub
  task: "...",
});
```

**Prevention:** When writing delegation tests, always use hub-compliant patterns. Check `validateHubAndSpoke()` in `types.ts` for validation logic.

**Date Added:** 2026-02-06
**Related Errors:** None

---

## TEST-001 API Response Structure Mismatch

**Pattern:** `expect(result).toHaveProperty('id', 'p1')` fails when API returns `{success: true, data: {...}}`
**Context:** Unit tests for agent tools (`BaseAgent` functions like `get_project_details`)
**Root Cause:** BaseAgent tool functions return a standardized response structure `{success: boolean, data?: any, error?: string}`, not the raw data. Tests that expect raw properties directly on the result will fail.
**Fix:**

```typescript
// ❌ Wrong - expecting raw data on result
const result = await functions.get_project_details({ projectId: "p1" });
expect(result).toHaveProperty("id", "p1");
expect(result).toHaveProperty("name", "Test Project");

// ✅ Correct - expecting wrapped response structure
const result = await functions.get_project_details({ projectId: "p1" });
expect(result).toHaveProperty("success", true);
expect(result.data).toHaveProperty("id", "p1");
expect(result.data).toHaveProperty("name", "Test Project");
```

**Prevention:** All BaseAgent tool functions wrap their results. When testing, always check for `success`, then access `result.data` for the actual payload.

**Date Added:** 2026-02-06
**Related Errors:** None

---

## MOCK-001 GoogleAuth Constructor Mock Pattern

**Pattern:** `TypeError: GoogleAuth is not a constructor` / CI hangs on OAuth network calls
**Context:** Unit tests for video generation or any code using `google-auth-library`
**Root Cause:** The `GoogleAuth` class from `google-auth-library` attempts real OAuth network calls at construction time. In CI without credentials, these calls hang indefinitely. Using `vi.fn()` as the mock doesn't properly work as a constructor in all cases.
**Fix:**

```typescript
// ❌ Wrong - vi.fn() may not work as constructor
vi.mock('google-auth-library', () => ({
    GoogleAuth: vi.fn()
}));

// ❌ Also wrong - vi.fn() returning object
vi.mock('google-auth-library', () => ({
    GoogleAuth: vi.fn(() => ({
        getClient: vi.fn().mockResolvedValue({...})
    }))
}));

// ✅ Correct - use class syntax
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        async getClient() {
            return { getAccessToken: async () => ({ token: 'mock-token' }) };
        }
        async getProjectId() {
            return 'mock-project-id';
        }
    }
}));
```

**Prevention:** Always use class syntax for mocking classes that will be instantiated with `new`. Add this mock BEFORE any imports that might trigger GoogleAuth initialization.

**Date Added:** 2026-02-06
**Related Errors:** TEST-001

---

## DEP-001 Circular Dependency Store Initialization

**Pattern:** `TypeError: Cannot read properties of undefined (reading 'id')` in `AgentRegistry` / CI hangs on tests
**Context:** Agent initialization, particularly when `useStore` is imported at the top level of tools.
**Root Cause:** Circular dependency: `Store` -> `AgentSlice` -> `AgentRegistry` -> `AgentConfig` -> `AgentDefinitions` -> `Tools` -> `useStore`. This causes `useStore` (and `AgentRegistry`) to be accessed before full initialization.
**Fix:**

1. Use `import type` in `types.ts` to break type-only cycles.
2. Move `useStore` imports inside functions (dynamic import) in tools/services.
3. Harden `AgentRegistry` logging to handle undefined configs gracefully.

```typescript
// ❌ Wrong - top-level static import
import { useStore } from "@/core/store";
export const myTool = () => {
  const state = useStore.getState();
};

// ✅ Correct - dynamic import within function
export const myTool = async () => {
  const { useStore } = await import("@/core/store");
  const state = useStore.getState();
};
```

**Date Added:** 2026-02-06
**Related Errors:** None

---

## AI-001 403 Forbidden on gemini-3-pro-preview

**Pattern:** `AI Verification Failed: {"error":{"code":403,"message":"Requests to this API generativelanguage.goog...`
**Stack Signature:** `403` from `generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent`
**Context:** All AI calls in production (chat, image gen, agent routing) fail with 403.
**Root Cause:** The API key (`VITE_API_KEY`) was revoked/throttled by Google — likely due to an API spike from a retry loop bug. Also: `gemini-3-pro-preview` requires **billing enabled** on the GCP project.
**Fix:**

1. Create a new API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Update `.env` locally: `VITE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`.
3. Update GitHub secret `VITE_API_KEY` for CI/CD.
4. Rebuild and redeploy (`npm run build:studio && firebase deploy --only hosting:app`).
5. Verify with curl:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=YOUR_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}' | head -c 200
```

**Prevention:** Monitor API usage in AI Studio. Fix retry loops that could spike usage. Set API key quotas in GCP Console.
**Related Files:** `.env`, `.github/workflows/deploy.yml`, `src/services/ai/FirebaseAIService.ts`
**Date Added:** 2026-02-12
**Related Errors:** AI-002

---

## AI-002 TTS Using Wrong Model (Text Model Instead of Audio)

**Pattern:** TTS calls fail silently or return text instead of audio.
**Context:** `generateSpeech()` in `FirebaseAIService.ts` was using `gemini-3-pro-preview` (a text model) instead of the dedicated `gemini-2.5-pro-tts`.
**Root Cause:** The `AI_MODELS` config had no `AUDIO.TTS` entry, so TTS defaulted to the general text model which doesn't support audio output.
**Fix:**

```typescript
// In ai-models.ts - add TTS constant
export const APPROVED_MODELS = {
  // ...existing...
  AUDIO_TTS: 'gemini-2.5-pro-tts',
};

export const AI_MODELS = {
  // ...existing...
  AUDIO: { TTS: APPROVED_MODELS.AUDIO_TTS },
};

// In FirebaseAIService.ts - use it
async generateSpeech(text: string, voice?: string, modelOverride?: string) {
  const model = modelOverride || AI_MODELS.AUDIO.TTS; // NOT the text model
  // ...
}
```

**Prevention:** Always check `ai-models.ts` when adding new modalities. Each modality needs its own model entry.
**Related Files:** `src/core/config/ai-models.ts`, `src/services/ai/FirebaseAIService.ts`
**Date Added:** 2026-02-12
**Related Errors:** AI-001
