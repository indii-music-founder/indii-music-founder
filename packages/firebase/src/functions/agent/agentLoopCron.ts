import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// ISSUE-1393: lazily resolve the Firestore handle INSIDE the invocation.
function getDb() {
    return admin.firestore();
}

export interface ScheduledLoopDefinition {
    id: string;
    userId?: string;
    trigger: string;
    [key: string]: unknown;
}

/**
 * Core handler to discover scheduled agent loop definitions and enqueue
 * executions under the correct tenant namespace: users/{userId}/agentLoopExecutions.
 * Exported for deterministic unit testing.
 */
export async function processAgentLoopCron(
    db: admin.firestore.Firestore = getDb()
): Promise<{ scheduledCount: number }> {
    // 1. Query user-scoped loop definitions (users/{userId}/agentLoopDefinitions)
    let userDefs: admin.firestore.QueryDocumentSnapshot[] = [];
    try {
        const userDefsSnapshot = await db.collectionGroup('agentLoopDefinitions')
            .where('trigger', '==', 'SCHEDULE')
            .get();
        userDefs = userDefsSnapshot.docs;
    } catch (e) {
        logger.warn('[AgentLoopCron] collectionGroup query failed or index missing, checking root collection:', e);
    }

    // 2. Also check root definitions collection if any exist
    const rootSnapshot = await db.collection('agentLoopDefinitions')
        .where('trigger', '==', 'SCHEDULE')
        .get();

    const allDocs = [...userDefs, ...rootSnapshot.docs];

    if (allDocs.length === 0) {
        logger.info('[AgentLoopCron] No scheduled agent loop definitions found.');
        return { scheduledCount: 0 };
    }

    const batch = db.batch();
    let count = 0;
    const seenLoopIds = new Set<string>();

    for (const doc of allDocs) {
        if (seenLoopIds.has(doc.id)) continue;
        seenLoopIds.add(doc.id);

        const data = doc.data() as ScheduledLoopDefinition;

        // Resolve userId: prefer explicit userId in doc, fallback to parent path (users/{userId}/...)
        let targetUserId = typeof data.userId === 'string' && data.userId.trim() ? data.userId.trim() : undefined;
        if (!targetUserId && doc.ref.parent?.parent?.id) {
            targetUserId = doc.ref.parent.parent.id;
        }

        const now = Date.now();
        if (targetUserId) {
            // Target the canonical path expected by AgentLoopService.ts
            const executionRef = db.collection('users').doc(targetUserId).collection('agentLoopExecutions').doc();
            batch.set(executionRef, {
                id: executionRef.id,
                loopId: doc.id,
                userId: targetUserId,
                status: 'IDLE',
                currentIteration: 0,
                history: [],
                createdAt: now,
                updatedAt: now
            });
            count++;
        } else {
            // Root fallback when no user association can be resolved
            const executionRef = db.collection('agentLoopExecutions').doc();
            batch.set(executionRef, {
                id: executionRef.id,
                loopId: doc.id,
                status: 'IDLE',
                currentIteration: 0,
                history: [],
                createdAt: now,
                updatedAt: now
            });
            count++;
        }
    }

    if (count > 0) {
        await batch.commit();
        logger.info(`[AgentLoopCron] Scheduled ${count} agent loops for execution.`);
    }

    return { scheduledCount: count };
}

/**
 * Scheduled Cloud Function to trigger autonomous agent loops.
 * Runs every 15 minutes to check for SCHEDULE trigger types.
 */
export const agentLoopCron = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeoutSeconds: 120,
        memory: '512MiB',
    },
    async () => {
        try {
            await processAgentLoopCron();
        } catch (error) {
            logger.error('[AgentLoopCron] Error in scheduled execution:', error);
            throw error;
        }
    }
);
