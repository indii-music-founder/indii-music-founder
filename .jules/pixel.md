# Pixel's Journal

## 2026-06-25 - Chat Overlay Placeholder Persistence
**Learning:** The "How can I help you?" placeholder in `ChatOverlay.tsx` only disappears when `messages.length > 0`. Waiting for it to detach *before* adding a message causes a timeout. Tests must verify its presence first, *then* add a message to trigger its removal.
**Action:** Always assert the "empty state" is visible before injecting data to clear it.
