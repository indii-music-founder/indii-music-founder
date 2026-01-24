# Error Ledger

A structured catalog of known errors and their fixes. **Check here first before debugging.**

---

## VEO-001 Unsupported Video Duration

**Pattern:** `Unsupported output video duration`
**Context:** Vertex AI Veo 3.1 video generation
**Root Cause:** The `durationSeconds` parameter is set to an unsupported value. Veo 3.1 only supports 4, 6, or 8 seconds.
**Fix:**

```typescript
// ❌ Wrong
durationSeconds: 5

// ✅ Correct - use 4, 6, or 8 only
durationSeconds: 6
```

**Date Added:** 2026-01-23
**Related Errors:** VERTEXAI-001

---

## FIRESTORE-001 Missing or Insufficient Permissions

**Pattern:** `Missing or insufficient permissions` / `PERMISSION_DENIED`
**Context:** Firestore reads/writes from frontend
**Root Cause:** Either Security Rules don't allow the operation, or the document path doesn't match the expected pattern (especially `users/{userId}` vs actual UID).
**Fix:**

1. Check `firestore.rules` for the specific collection path.
2. Verify the user's UID matches the document path pattern.
3. Ensure `request.auth != null` for authenticated routes.
4. Check if nested subcollections need explicit rules.

**Date Added:** 2026-01-23
**Related Errors:** AUTH-001

---

## MODEL-001 Deprecated Model Usage

**Pattern:** Using `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, etc.
**Context:** Any AI service call
**Root Cause:** These models are deprecated or banned per MODEL_POLICY.md. Only Gemini 3 models are approved.
**Fix:**

```typescript
// ❌ Wrong - hardcoded deprecated model
const model = "gemini-1.5-flash";

// ✅ Correct - use constants from config
import { AI_MODELS } from '@/core/config/ai-models';
const model = AI_MODELS.TEXT.FAST; // gemini-3-flash-preview
```

**Date Added:** 2026-01-23
**Related Errors:** None

---

## CORS-001 Access Control Blocked

**Pattern:** `Access-Control-Allow-Origin` / `CORS policy: No 'Access-Control-Allow-Origin'`
**Context:** Frontend fetching assets from Firebase Storage or external APIs
**Root Cause:** Browser blocks cross-origin requests when CORS headers are missing.
**Fix:**

1. For Firebase Storage: Configure CORS via `gsutil cors set cors.json gs://bucket-name`
2. For Electron: Requests from `file://` may fail; use Data URI fallback.
3. Fallback pattern:

```typescript
try {
  // Try direct upload
  await uploadToStorage(blob);
} catch (corsError) {
  // Fallback to Data URI
  const dataUri = await blobToDataUri(blob);
  // Store dataUri instead
}
```

**Date Added:** 2026-01-23
**Related Errors:** None

---

## VERTEXAI-001 Region Mismatch 403

**Pattern:** `403 Forbidden` on video generation / model not found
**Context:** Vertex AI Veo calls from Cloud Functions
**Root Cause:** Veo 3.1 is only available in `us-west1`. Functions deployed to other regions will fail.
**Fix:**

1. Deploy the video generation function to `us-west1`:

```typescript
export const generateVideo = onCall({
  region: "us-west1",
  // ...
});
```

1. Ensure client calls target the correct region endpoint.

**Date Added:** 2026-01-23
**Related Errors:** VEO-001

---

## BUILD-001 Already Declared Error

**Pattern:** `'X' is already declared in the upper scope`
**Context:** TypeScript/React components
**Root Cause:** Duplicate variable or import declarations, often from copy-paste errors or conflicting imports.
**Fix:**

1. Search for duplicate declarations of the variable name.
2. Remove the duplicate or rename one instance.
3. Check for duplicate imports at the file top.

**Date Added:** 2026-01-23
**Related Errors:** None

---

## TYPE-001 Undefined Field in Object

**Pattern:** `Cannot read property 'X' of undefined` / `undefined is not an object`
**Context:** Runtime errors when accessing nested objects
**Root Cause:** The parent object is undefined. Common with Firestore data that may not exist yet.
**Fix:**

```typescript
// ❌ Wrong - no safety check
const value = data.nested.field;

// ✅ Correct - optional chaining
const value = data?.nested?.field;

// ✅ Correct - with fallback
const value = data?.nested?.field ?? 'default';
```

**Date Added:** 2026-01-23
**Related Errors:** FIRESTORE-001

---

## AUTH-001 User Not Authenticated

**Pattern:** `auth.currentUser is null` / `User is not logged in`
**Context:** Operations requiring authentication
**Root Cause:** Code runs before Firebase Auth initializes, or user session expired.
**Fix:**

```typescript
// ❌ Wrong - immediate access
const user = auth.currentUser;

// ✅ Correct - wait for auth state
import { onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
  }
});
```

**Date Added:** 2026-01-23
**Related Errors:** FIRESTORE-001

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
