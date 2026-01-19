# Bolt's Journal

## 2024-05-22 - Initial Entry
**Learning:** Initialized Bolt's journal.
**Action:** Always check this file for critical performance learnings.
## 2024-05-22 - Layout Thrashing in Auto-Resize Textarea
**Learning:** Synchronous DOM read/write operations (like reading `scrollHeight` after setting `style.height`) inside high-frequency event handlers (like `onChange`) cause layout thrashing, blocking the main thread.
**Action:** Wrap these operations in `requestAnimationFrame` to batch them into the next frame, unblocking the input event loop while maintaining visual updates. Update tests to wait for animation frames using `vi.advanceTimersByTime`.
