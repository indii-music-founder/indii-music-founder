/**
 * LegacyOrgMigrationService — ISSUE-772 backfill.
 *
 * Historical documents in `history` and `sessions` were stamped with the
 * placeholder org id 'org-default' (the profileSlice pre-resolution default).
 * Firestore rules reject org-scope queries for that phantom org, so those
 * documents are unreadable through the normal org-filtered subscriptions and
 * every device shows a different, session-local library.
 *
 * This service rewrites the caller's own legacy documents to orgId 'personal'
 * (reads and updates are provable under rules via the userId filter). It is
 * idempotent: once no documents match, each run costs two empty queries.
 */

import { collection, query, where, limit, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { logger } from '@/utils/logger';

const LEGACY_ORG_ID = 'org-default';
const TARGET_ORG_ID = 'personal';
const BATCH_SIZE = 400; // Firestore batch limit is 500

async function migrateCollection(collectionName: string, uid: string): Promise<number> {
    let migrated = 0;

    // Loop until no legacy docs remain (each pass rewrites up to BATCH_SIZE)
    for (;;) {
        const q = query(
            collection(db, collectionName),
            where('userId', '==', uid),
            where('orgId', '==', LEGACY_ORG_ID),
            limit(BATCH_SIZE)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.update(doc(db, collectionName, d.id), { orgId: TARGET_ORG_ID });
        });
        await batch.commit();

        migrated += snapshot.size;
        if (snapshot.size < BATCH_SIZE) break;
    }

    return migrated;
}

export const LegacyOrgMigrationService = {
    /**
     * Rewrite the signed-in user's 'org-default' documents to 'personal' scope.
     * Safe to call on every login. Failures are logged, never thrown — the app
     * must still boot if migration is temporarily unavailable (offline, rules).
     */
    async run(): Promise<{ history: number; sessions: number } | null> {
        const uid = auth.currentUser?.uid;
        if (!uid) return null;

        try {
            const [history, sessions] = await Promise.all([
                migrateCollection('history', uid),
                migrateCollection('sessions', uid),
            ]);

            if (history > 0 || sessions > 0) {
                logger.info(`[LegacyOrgMigration] Rescoped legacy docs to personal — history: ${history}, sessions: ${sessions}`);
            }
            return { history, sessions };
        } catch (err) {
            logger.error('[LegacyOrgMigration] Migration failed (will retry next login):', err);
            return null;
        }
    },
};
