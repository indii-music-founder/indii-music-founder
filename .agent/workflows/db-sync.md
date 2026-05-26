---
description: Database and Security Rules synchronization workflow. Audit rules and sync changes to firestore.rules or storage.rules safely.
---

# /db-sync — Firebase Security Rules & Schema Auditor

**Activates the automated database security audit and rules synchronizer.**

This command is used during the `/middle` phase whenever a Firestore schema, collection key, dynamic document field, or Storage upload directory is modified. It ensures database logic is perfectly synchronized and client-side changes do not open up unauthorized database write permissions.

## 1. Schema & Collection Scan
- **Collection Audit:** Scan recent codebase changes (such as custom service layer files `*Service.ts` or Zustand store files `*Slice.ts`) to identify any newly introduced Firestore collections, collections paths, or sub-collections.
- **Reference Resolution:** Cross-reference all Firestore queries (such as `addDoc`, `updateDoc`, `setDoc`, `deleteDoc`) against the registered collections in the project.

## 2. Hard Security Rules Audit (via `firebase-security-rules-auditor`)
Invoke the **Firebase Security Rules Auditor** skill to evaluate rules:
- **`firestore.rules` Scan:**
  - Verify that there are zero wildcards that allow public, unauthenticated read/write access (e.g., `allow read, write: if true;` or `allow write: if request.auth != null;` without specific resource field checks).
  - Ensure all write operations specify correct request data validators (e.g. `request.resource.data`).
  - Verify that only the document owner or designated role can update/delete records.
- **`storage.rules` Scan:**
  - Ensure upload paths are directory-isolated by User ID (`request.auth.uid`).
  - Ensure media uploads enforce content-type limits (e.g., matching expected audio/image mime types) and size thresholds.

## 3. Local Validation & Sync
- Run security rule validation locally using the Firebase Emulator suite or direct syntax checks:
  ```bash
  npx -y firebase-tools@latest deploy --only firestore:rules --dry-run
  ```
- **Sync Rule:** Any schema shift MUST be documented. If `db-sync` discovers a gap where a collection is created but no corresponding secure rule exists in `firestore.rules`, it **MUST** automatically append a production-grade rules block to close the gate.

## 4. Gap Verification Checklist
Output the results of the database sync gate:
```text
=== DB-SYNC SECURITY VERIFICATION ===
[✓] Collection Paths Resolved
[✓] firestore.rules Syntax: Valid
[✓] Storage Upload Boundaries: Enforced by Owner UID
[✓] Public Wildcards Scan: Passed (0 leaks detected)
```
