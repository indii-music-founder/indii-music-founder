import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';


const db = admin.firestore();

/**
 * Scheduled Cloud Function to trigger autonomous agent loops.
 * Runs every 15 minutes to check for SCHEDULE trigger types.
 */
export const agentLoopCron = onSchedule(
    {
        schedule: 'every 15 minutes',
        timeoutSeconds: 120,
        memory: '256MiB',
    },
    async () => {
        try {
            // Find all loop definitions that are scheduled
            const definitionsSnapshot = await db.collection('agentLoopDefinitions')
                .where('trigger', '==', 'SCHEDULE')
                .get();

            if (definitionsSnapshot.empty) {
                logger.info('[AgentLoopCron] No scheduled agent loop definitions found.');
                return;
            }

            const batch = db.batch();
            let count = 0;

            for (const doc of definitionsSnapshot.docs) {
                // Create an execution document for the agent service to pick up
                const executionRef = db.collection('agentLoopExecutions').doc();
                batch.set(executionRef, {
                    id: executionRef.id,
                    loopId: doc.id,
                    status: 'IDLE',
                    currentIteration: 0,
                    history: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                count++;
            }

            if (count > 0) {
                await batch.commit();
                logger.info(`[AgentLoopCron] Scheduled ${count} agent loops for execution.`);
            }
        } catch (error) {
            logger.error('[AgentLoopCron] Error:', error);
        }
    }
);
