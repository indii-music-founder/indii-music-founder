## 2025-05-18 - Sequential Firestore Deletes
**Learning:** The `FileSystemService` was using naive recursion for deleting folders, resulting in N+1 sequential network requests (where N is the number of descendants) and redundant delete calls for nested folders. This is a common anti-pattern when working with Firestore hierarchies without server-side support.
**Action:** Always prefer `writeBatch` for bulk operations. For hierarchical data, traverse the tree in memory to collect IDs first, then execute a single batch delete. This reduces N round trips to 1 (or N/500).
# Bolt's Journal

## 2024-05-22 - Initial Entry
**Learning:** Initialized Bolt's journal.
**Action:** Always check this file for critical performance learnings.
## 2024-05-22 - Layout Thrashing in Auto-Resize Textarea
**Learning:** Synchronous DOM read/write operations (like reading `scrollHeight` after setting `style.height`) inside high-frequency event handlers (like `onChange`) cause layout thrashing, blocking the main thread.
**Action:** Wrap these operations in `requestAnimationFrame` to batch them into the next frame, unblocking the input event loop while maintaining visual updates. Update tests to wait for animation frames using `vi.advanceTimersByTime`.
