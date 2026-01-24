# Pixel's Journal

## 2026-06-25 - Chat Overlay Placeholder Persistence
**Learning:** The "How can I help you?" placeholder in `ChatOverlay.tsx` only disappears when `messages.length > 0`. Waiting for it to detach *before* adding a message causes a timeout. Tests must verify its presence first, *then* add a message to trigger its removal.
**Action:** Always assert the "empty state" is visible before injecting data to clear it.

## 2026-06-25 - ChatOverlay Store Dependencies
**Learning:** `ChatOverlay` tests failed because the embedded `PromptArea` component depends on `ToastContext` and specific store slices (`commandBarInput`, `commandBarAttachments`, `agentWindowSize`) that were missing from the `ChatOverlay` mock setup.
**Action:** When testing container components, verify dependencies of *all* children (even docked ones like `PromptArea`) and include them in the mock store/context.
