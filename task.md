# Recovery and Persistence Debugging Plan

## Status

- **Project**: Rndr-AI-v1
- **Current Issue**: Recovering from a crash, debugging Firestore persistence.
- **Last Known State**: `StorageService.ts` has `orderBy` commented out.

## Objectives

1. **Verify Environment**: Ensure dependencies are installed and dev server runs.
2. **Fix Persistence**:
    - Uncomment `orderBy` in `StorageService.ts`.
    - Verify Firestore rules and indexes.
    - Test saving and loading history items.
3. **Address "White Page" / Crash**:
    - Monitor console for errors during startup.
    - Verify app loads correctly.

## Next Steps

- [x] Uncomment `orderBy` in `StorageService.ts`.
- [x] Start the development server (Running on port 3002).
- [x] Verify the application loads (White page fixed).
- [ ] Check console for "Missing or insufficient permissions" or other errors.
- [x] **Model Discovery**: `gemini-3.0-pro` was incorrect. Correct model is `gemini-3-pro-preview`.
  - **Text/Agent**: Using `gemini-3-pro-preview` (High Thinking).
  - **Routing/Fast**: Using `gemini-3-pro-preview` (Low Thinking).
  - **Image**: Using `gemini-3-pro-image-preview`.
- [x] **Refactoring**: Centralized model config in `src/core/config/ai-models.ts` and updated all services.
- [ ] **ACTION REQUIRED**: Enable Anonymous Sign-in in Firebase Console to fix persistence.
