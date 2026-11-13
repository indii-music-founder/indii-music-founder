import { createHash } from 'node:crypto';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { AgentLoopDefinitionSnapshotSchema } from '@indii/shared';

function getDb() {
    return admin.firestore();
}

/** Queue one fully initialized execution per definition and scheduled occurrence.
 * Does not execute agent actions. Atomic create prevents a redelivery from
 * replacing an execution that another client has already claimed or completed.
 */
export async function processAgentLoopCron(
    db: admin.firestore.Firestore = getDb(),
    scheduledFor: number = Date.now(),
): Promise<{ scheduledCount: number }> {
    if (!Number.isSafeInteger(scheduledFor) || scheduledFor < 0) throw new Error('Invalid scheduled loop occurrence time');

    // A collection-group query includes both root and nested collections. If it
    // fails, propagate the failure so retries cannot silently omit user tenants.
    const snapshot = await db.collectionGroup('agentLoopDefinitions')
        .where('trigger', '==', 'SCHEDULE').get();
    const definitions = [...new Map(snapshot.docs.map(document => [document.ref.path, document])).values()];

    const enqueue = async (document: admin.firestore.QueryDocumentSnapshot): Promise<number> => {
        const path = document.ref.path;
        const segments = path.split('/');
        const data = document.data();
        const scoped = segments.length === 4 && segments[0] === 'users' && segments[2] === 'agentLoopDefinitions';
        const root = segments.length === 2 && segments[0] === 'agentLoopDefinitions';
        const owner = scoped ? segments[1] : root && typeof data.userId === 'string' ? data.userId : undefined;
        if (!owner || owner.trim() !== owner || owner.includes('/') || owner.length > 128
            || scoped && data.userId !== undefined && data.userId !== owner) {
            logger.warn('[AgentLoopCron] Skipping definition with missing or inconsistent tenant ownership', { path });
            return 0;
        }
        const parsed = AgentLoopDefinitionSnapshotSchema.safeParse({ ...data, id: document.id });
        if (!parsed.success || parsed.data.trigger !== 'SCHEDULE' || parsed.data.judgeMode !== 'LLM_EVALUATION'
            || !parsed.data.goal.trim() || !parsed.data.verifiabilityCriteria.trim()) {
            logger.warn('[AgentLoopCron] Skipping definition without a usable goal and verifier', { path });
            return 0;
        }
        const digest = createHash('sha256').update(`${path}\0${scheduledFor}`).digest('hex');
        const execution = db.collection('users').doc(owner).collection('agentLoopExecutions').doc(`scheduled-${digest}`);
        const now = Date.now();
        try {
            await execution.create({
                id: execution.id, loopId: document.id, userId: owner,
                sourceDefinitionPath: path, scheduledFor,
                definitionSnapshot: parsed.data,
                status: 'IDLE', currentIteration: 1, history: [],
                actionCheckpoint: { phase: 'READY', iteration: 1 },
                tokenBudgetSpent: 0, checkpointRevision: 1,
                createdAt: now, updatedAt: now,
            });
            return 1;
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            if (code === 6 || code === 'already-exists') return 0;
            throw error;
        }
    };

    let scheduledCount = 0;
    // Bound concurrent writes and await every outcome before allowing a retry.
    // Successful creates survive partial failures and are skipped on redelivery.
    for (let offset = 0; offset < definitions.length; offset += 20) {
        const outcomes = await Promise.allSettled(definitions.slice(offset, offset + 20).map(enqueue));
        const failures: unknown[] = [];
        for (const result of outcomes) {
            if (result.status === 'fulfilled') scheduledCount += result.value;
            else failures.push(result.reason);
        }
        if (failures.length) throw new AggregateError(failures, 'Scheduled loop admission did not finish; retry the same occurrence.');
    }
    logger.info(`[AgentLoopCron] Queued ${scheduledCount} new loop executions.`);
    return { scheduledCount };
}

export const agentLoopCron = onSchedule(
    {
        // Unix-cron is required for the stable original-time header; groc omits it.
        schedule: '*/15 * * * *', timeZone: 'UTC', timeoutSeconds: 120, memory: '512MiB',
        retryCount: 3, minBackoffSeconds: 10, maxBackoffSeconds: 60,
    },
    async event => {
        try {
            // Keep the scheduler's original occurrence time across retries,
            // even when a delayed delivery crosses into a later time window.
            await processAgentLoopCron(getDb(), Date.parse(event.scheduleTime));
        } catch (error) {
            logger.error('[AgentLoopCron] Error in scheduled execution:', error);
            throw error;
        }
    },
);
