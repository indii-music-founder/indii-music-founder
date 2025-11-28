# Schema Upgrade Notes

## Current State (v7.6)
The IndexedDB schema currently lacks `projectId` indices on the following object stores:
- `images`
- `history`
- `prompts`
- `canvas`
- `settings` (This is a key-value store, so it might not need an index, but project-specific settings are stored mixed with global settings)

Only `agent_memory` has a `projectId` index.

## Issue
Deleting a project currently requires iterating through ALL records in these stores and checking the `projectId` field in JavaScript. This is O(N) where N is total records, which is acceptable for current usage but will become a performance bottleneck as the user's library grows.

## Future Upgrade Path
To fix this, we need to:
1. Increment `DB_VERSION` in `db.ts`.
2. In the `onupgradeneeded` handler, create indices for `projectId` on the stores mentioned above.
   ```typescript
   if (!store.indexNames.contains('projectId')) {
       store.createIndex('projectId', 'projectId', { unique: false });
   }
   ```
3. Once indices are in place, deletion becomes O(1) (or O(M) where M is records in that project) using `IDBIndex.openCursor` or `getAllKeys`.

## Current Workaround
For the "Deep Clean" feature in this version, we are using the "scan and delete" approach (`deleteProjectData` function in `db.ts`) which iterates all records. This is safe but slower.
