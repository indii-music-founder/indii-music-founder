/**
 * catalogAdminSweep — the weekly continuous-audit sweep (Pillar 1; plan §2.2.1
 * trigger (iii), deferred from P2 and delivered here).
 *
 * Event triggers audit a catalog the moment something happens; this sweep is
 * what keeps watching when nothing happens: it pages the user base (bounded,
 * cursor-resumable across weeks), finds `master_admin` states whose audit is
 * stale (updatedAt older than the cutoff), and re-emits
 * `admin/audit.requested` for them. Downstream idempotency is the task
 * dedupeKey — a re-audit can never duplicate a task or resurrect a resolved one.
 *
 * Pattern mirror: `timeline/pollTimelineMilestones.ts` (onSchedule + pure
 * helpers exported for tests + Inngest dispatch).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { Inngest } from 'inngest';

const inngestEventKey = defineSecret('INNGEST_EVENT_KEY');

function getDb() {
    return admin.firestore();
}

export const SWEEP_CURSOR_PATH = 'admin_sweep_state/catalogSweep';
export const SWEEP_PAGE_SIZE = 25;
export const SWEEP_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const SWEEP_MAX_MASTERS_PER_USER = 20;

export interface SweepCursor {
    lastUserId: string | null;
    completedAt: string | null;
}

/** Pure: which of a user's master states need a re-audit at this cutoff. */
export function selectStaleMasterHashes(
    masters: ReadonlyArray<{ masterHash: string; updatedAtMs: number }>,
    cutoffMs: number,
): string[] {
    return masters
        .filter((master) => master.updatedAtMs < cutoffMs)
        .map((master) => master.masterHash);
}

/** Pure: cursor advance for one processed page. */
export function advanceCursor(cursor: SweepCursor, pageLastUserId: string | null, pageWasEmpty: boolean): SweepCursor {
    if (pageWasEmpty) {
        return { lastUserId: null, completedAt: new Date().toISOString() };
    }
    return { lastUserId: pageLastUserId, completedAt: cursor.completedAt };
}

export const catalogAdminSweep = onSchedule(
    {
        // Mondays 06:17 UTC — deliberately off the hour to avoid contention
        // with the hourly delivery-status pollers.
        schedule: 'TZ=UTC 17 6 * * 1',
        secrets: [inngestEventKey],
        memory: '512MiB',
    },
    async () => {
        const db = getDb();
        const cursorRef = db.doc(SWEEP_CURSOR_PATH);
        const cursorSnap = await cursorRef.get();
        const cursor = (cursorSnap.data() ?? { lastUserId: null, completedAt: null }) as SweepCursor;
        const cutoffMs = Date.now() - SWEEP_STALE_AFTER_MS;

        const usersQuery: admin.firestore.Query = db
            .collection('users')
            .orderBy('__name__')
            .where(admin.firestore.FieldPath.documentId(), '>', cursor.lastUserId)
            .limit(SWEEP_PAGE_SIZE);
        const users = await usersQuery.get();
        if (users.empty) {
            await cursorRef.set({ lastUserId: null, completedAt: new Date().toISOString() });
            console.log('[catalogAdminSweep] sweep cycle complete — cursor reset.');
            return;
        }

        const client = new Inngest({ id: 'indii-music-functions', eventKey: inngestEventKey.value() });
        let auditedMasters = 0;
        let pageLastUserId: string | null = null;

        for (const user of users.docs) {
            pageLastUserId = user.id;
            const masters = await db
                .collection('users')
                .doc(user.id)
                .collection('master_admin')
                .limit(SWEEP_MAX_MASTERS_PER_USER)
                .get();
            const stale = selectStaleMasterHashes(
                masters.docs
                    .map((document) => {
                        const data = document.data();
                        const updatedAt = data['updatedAt'];
                        const updatedAtMs = typeof updatedAt?.toMillis === 'function' ? updatedAt.toMillis() : Number(updatedAt ?? 0);
                        return { masterHash: String(data['masterHash'] ?? document.id), updatedAtMs };
                    }),
                cutoffMs,
            );
            for (const masterHash of stale) {
                await client.send({
                    name: 'admin/audit.requested',
                    data: { userId: user.id, entityType: 'master', entityRefs: { masterHash } },
                    user: { id: user.id },
                });
                auditedMasters += 1;
            }
        }

        const nextCursor = advanceCursor(cursor, pageLastUserId, users.docs.length === 0);
        await cursorRef.set(nextCursor);
        console.log(`[catalogAdminSweep] page processed: ${users.docs.length} user(s), ${auditedMasters} stale master(s) re-audited; cursor=${nextCursor.lastUserId ?? 'cycle-complete'}.`);
    },
);
