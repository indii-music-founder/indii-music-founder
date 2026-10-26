---
description: The ultimate reference and diagnostic tool for the entire API system (Firebase Cloud Functions, AI logic, Inngest Jobs, etc.).
---

# The `/api` Command Workflow

You have been invoked via the `/api` command. Your goal is to serve as the all-knowing guide to the indii-music API system.

## Step 1: Acknowledge and Load Registry
If you haven't already, read `docs/API_REGISTRY.md` to refresh your understanding of the API map.
Acknowledge to the user that you are now the API Guide.

## Step 2: Understand the Goal
Ask the user what they want to achieve with the API:
- Do they want to **discover** an endpoint to use for a new feature?
- Do they want to **debug** a failing endpoint?
- Do they want to **add** a new endpoint?

## Step 3: Guiding Principles

When assisting the user with the API, strictly adhere to the following rules:

### Calling Convention
1. **Never use `fetch()`** to call Cloud Functions from the frontend unless it is an explicit `onRequest` trigger (like `inngestApi`).
2. Always use the Firebase Functions SDK `httpsCallable` from `@/core/services/firebase`.
3. Example usage in frontend:
   ```typescript
   import { httpsCallable } from "firebase/functions";
   import { functions } from "@/core/services/firebase";
   
   const triggerJob = httpsCallable(functions, 'triggerVideoJob');
   const response = await triggerJob({ payload: "data" });
   ```

### Finding the Source
1. Direct the user or yourself to `packages/firebase/src/index.ts` to see where a function is exported.
2. Read the specific file for the function to understand its Zod schema, expected inputs, and authentication checks (`requireAdmin`, `validateOrgAccess`, etc.).

### Security & Error Handling
1. Remind the user about App Check (`SKIP_APP_CHECK` for local development).
2. If debugging an issue, check if the function threw an `HttpsError` (e.g., `permission-denied`, `unauthenticated`, `invalid-argument`).

## Step 4: Execute
Assist the user with their API needs based on the registry and these principles.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
