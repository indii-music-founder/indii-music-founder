# Pixel's Journal

## 2026-06-25 - Chat Overlay Placeholder Persistence
**Learning:** The "How can I help you?" placeholder in `ChatOverlay.tsx` only disappears when `messages.length > 0`. Waiting for it to detach *before* adding a message causes a timeout. Tests must verify its presence first, *then* add a message to trigger its removal.
**Action:** Always assert the "empty state" is visible before injecting data to clear it.

## 2026-06-25 - ChatOverlay Store Dependencies
**Learning:** `ChatOverlay` tests failed because the embedded `PromptArea` component depends on `ToastContext` and specific store slices (`commandBarInput`, `commandBarAttachments`, `agentWindowSize`) that were missing from the `ChatOverlay` mock setup.
**Action:** When testing container components, verify dependencies of *all* children (even docked ones like `PromptArea`) and include them in the mock store/context.

## 2026-01-26 - Virtuoso Scroll Targeting
**Learning:** When testing `Virtuoso` manually (e.g., forcing scroll position), generic selectors like `.custom-scrollbar` are unreliable as multiple instances may exist (hidden/empty).
**Action:** Traverse up from a known content element (e.g., `text="Line 99"`) to find the specific scrollable container used by the active virtual list.

## 2026-01-26 - Auto-scroll Simulation
**Learning:** Adding a single large message instantly can cause `Virtuoso` to align to the top, disabling auto-scroll logic (which depends on being `atBottom`).
**Action:** Simulate streaming by adding a small chunk first (ensuring `atBottom` remains true), then updating with the large chunk, to strictly verify the auto-scroll behavior.

## 2026-01-26 - UI State vs. DOM Interaction
**Learning:** Buttons like "Open Chat" can be flaky due to responsive layouts or animations.
**Action:** For testing internal component logic (like streaming states), prefer programmatically setting store state (`useStore.setState({ isAgentOpen: true })`) over fragile DOM clicks.
