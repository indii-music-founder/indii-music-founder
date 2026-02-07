# Firestore Schema Migration Strategy

> **indiiOS-Alpha-Electron** — Database migration approach for Firestore

---

## Overview

Firestore is schemaless, so migrations focus on **data shape changes** rather than table DDL. This document outlines the strategy for safely evolving document structures in production.

---

## Migration Types

### 1. Additive (Non-Breaking)
**Risk: Low** — No migration needed.

- Adding a new optional field to a document
- Adding a new collection
- Adding a new index

**Strategy:** Deploy code that reads the new field with a fallback default.

```typescript
// Safe: new field with default
const tier = doc.data()?.membershipTier ?? 'free';
```

### 2. Rename / Restructure (Breaking)
**Risk: Medium** — Requires dual-read period.

- Renaming a field (e.g., `name` → `displayName`)
- Moving a field to a subcollection
- Changing field type (e.g., string → array)

**Strategy:** Three-phase deployment:

| Phase | Duration | Action |
|-------|----------|--------|
| 1. Dual Write | 1 deploy | Write to **both** old and new field |
| 2. Backfill | 1-time script | Migrate existing documents to new shape |
| 3. Cleanup | Next deploy | Remove old field reads/writes |

### 3. Destructive (High Risk)
**Risk: High** — Data loss possible.

- Deleting a collection
- Removing a required field
- Changing document ID scheme

**Strategy:** Always use the CleanupService dry-run first, back up data, then execute with confirmation.

---

## Migration Scripts

Place migration scripts in `scripts/migrations/` with naming convention:

```
scripts/migrations/
├── 001_add_membership_tier.ts
├── 002_rename_user_name.ts
└── README.md
```

### Script Template

```typescript
import admin from 'firebase-admin';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

async function migrate() {
    const db = admin.firestore();
    const collection = db.collection('users');
    let migrated = 0;
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
        let query = collection.orderBy('__name__').limit(BATCH_SIZE);
        if (cursor) query = query.startAfter(cursor);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        for (const doc of snapshot.docs) {
            // Skip already-migrated documents
            if (doc.data().newField !== undefined) continue;

            if (!DRY_RUN) {
                batch.update(doc.ref, {
                    newField: computeDefault(doc.data()),
                });
            }
            migrated++;
        }

        if (!DRY_RUN) await batch.commit();
        cursor = snapshot.docs[snapshot.docs.length - 1];
        console.log(`Processed ${migrated} documents...`);
    }

    console.log(`${DRY_RUN ? '[DRY RUN] Would migrate' : 'Migrated'} ${migrated} documents`);
}

migrate().catch(console.error);
```

---

## Firestore Indexes

Index changes are deployed via `firebase deploy --only firestore:indexes`.

- Composite indexes are defined in `firestore.indexes.json`
- Single-field indexes are automatic
- New indexes can take minutes to build — deploy indexes **before** deploying code that queries them

---

## Rollback Procedure

1. **Additive changes:** No rollback needed (old code ignores new fields)
2. **Rename migrations:** Revert to Phase 1 code (dual-read) — both fields still exist
3. **Destructive changes:** Restore from backup (see Backup section below)

---

## Backup Strategy

Before any destructive migration:

```bash
# Export entire Firestore database
gcloud firestore export gs://indiios-v-1-1-backups/$(date +%Y%m%d_%H%M%S)

# Export specific collection
gcloud firestore export gs://indiios-v-1-1-backups/users_backup \
  --collection-ids=users
```

Verify backup integrity:

```bash
gcloud firestore operations list --filter="metadata.outputUriPrefix:gs://indiios-v-1-1-backups"
```

---

## Checklist

Before running any migration:

- [ ] Script has `--dry-run` flag and it works
- [ ] Dry run output reviewed and approved
- [ ] Firestore backup taken
- [ ] Security rules updated if new collections/fields need access control
- [ ] Indexes deployed if new queries are needed
- [ ] Rollback plan documented
- [ ] Migration logged in `scripts/migrations/README.md`
