## 2025-05-18 - Sequential Firestore Deletes
**Learning:** The `FileSystemService` was using naive recursion for deleting folders, resulting in N+1 sequential network requests (where N is the number of descendants) and redundant delete calls for nested folders. This is a common anti-pattern when working with Firestore hierarchies without server-side support.
**Action:** Always prefer `writeBatch` for bulk operations. For hierarchical data, traverse the tree in memory to collect IDs first, then execute a single batch delete. This reduces N round trips to 1 (or N/500).
