/**
 * pollTimelineMilestones.ts
 *
 * Firebase Cloud Scheduler function that runs every 15 minutes to check
 * for due timeline milestones and dispatch their execution via Inngest.
 *
 * Flow:
 * 1. Query all users' `timelines` collections for `status === 'active'`
 * 2. Find milestones with `status === 'pending'` and `scheduledAt <= now`
 * 3. For each due milestone, dispatch a `timeline/milestone.due` event to Inngest
 * 4. Inngest's `executeMilestoneFn` picks it up and runs the agent server-side
 *
 * This is the autonomy bridge — milestones execute even when the user is offline.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Inngest } from 'inngest';

const db = admin.firestore();

// ============================================================================
// Types (duplicated from client to avoid cross-project imports)
// ============================================================================

interface TimelineMilestone {
    id: string;
    phaseId: string;
    phaseName: string;
    scheduledAt: number;
    type: string;
    instruction: string;
    assetStrategy: string;
    status: string;
    agentId: string;
    platform?: string;
    result?: string;
    error?: string;
    executedAt?: number;
    retryCount?: number;
}

interface Timeline {
    id: string;
    userId: string;
    title: string;
    goal: string;
    domain: string;
    status: string;
    phases: Array<{ id: string; name: string; order: number }>;
    milestones: TimelineMilestone[];
    currentPhaseOrder: number;
    completedCount: number;
    totalCount: number;
    updatedAt: number;
}

// ============================================================================
// Inngest Client (lazy init — secrets only available at runtime)
// ============================================================================

let inngestClient: Inngest | null = null;

function getInngest(): Inngest {
    if (!inngestClient) {
        const eventKey = process.env.INNGEST_EVENT_KEY || '';
        inngestClient = new Inngest({
            id: 'indii-os-timeline-poller',
            eventKey,
        });
    }
    return inngestClient;
}

// ============================================================================
// Cloud Function
// ============================================================================

/**
 * pollTimelineMilestones
 *
 * Runs every 15 minutes. Finds due milestones and dispatches them
 * to Inngest for fully autonomous server-side execution.
 */
export const pollTimelineMilestones = onSchedule(
    {
        schedule: 'every 15 minutes',
        region: 'us-central1',
        timeoutSeconds: 120,
        memory: '256MiB',
        secrets: ['INNGEST_EVENT_KEY'],
    },
    async () => {
        const now = Date.now();
        console.log(`[pollTimelineMilestones] Checking for due milestones at ${new Date(now).toISOString()}`);

        let totalProcessed = 0;
        let totalDue = 0;
        const inngest = getInngest();

        try {
            // Get all user timeline collections
            // Structure: timelines/{userId}/items/{timelineId}
            const usersSnapshot = await db.collection('timelines').listDocuments();

            for (const userDoc of usersSnapshot) {
                const userId = userDoc.id;
                const itemsRef = userDoc.collection('items');

                // Query active timelines for this user
                const activeTimelinesSnap = await itemsRef
                    .where('status', '==', 'active')
                    .get();

                for (const timelineDoc of activeTimelinesSnap.docs) {
                    const timeline = timelineDoc.data() as Timeline;
                    let updated = false;

                    // Find due milestones
                    for (let i = 0; i < timeline.milestones.length; i++) {
                        const milestone = timeline.milestones[i];

                        if (milestone.status === 'pending' && milestone.scheduledAt <= now) {
                            totalDue++;

                            // Mark milestone as dispatched (prevents double-fire on next poll)
                            timeline.milestones[i] = {
                                ...milestone,
                                status: 'executing',
                            };
                            updated = true;

                            console.log(
                                `[pollTimelineMilestones] Dispatching milestone: "${milestone.instruction.slice(0, 80)}..." ` +
                                `(timeline: ${timeline.title}, phase: ${milestone.phaseName}, agent: ${milestone.agentId})`
                            );

                            // Dispatch to Inngest for autonomous server-side execution
                            try {
                                await inngest.send({
                                    name: 'timeline/milestone.due',
                                    data: {
                                        userId,
                                        timelineId: timeline.id,
                                        milestoneId: milestone.id,
                                        agentId: milestone.agentId,
                                        instruction: milestone.instruction,
                                        assetStrategy: milestone.assetStrategy,
                                        phaseName: milestone.phaseName,
                                        type: milestone.type,
                                        platform: milestone.platform ?? null,
                                        goal: timeline.goal,
                                        title: timeline.title,
                                        domain: timeline.domain,
                                    },
                                });
                                totalProcessed++;
                                console.log(
                                    `[pollTimelineMilestones] Inngest event sent for milestone ${milestone.id}`
                                );
                            } catch (sendError) {
                                console.error(
                                    `[pollTimelineMilestones] Failed to send Inngest event for milestone ${milestone.id}:`,
                                    sendError
                                );
                                // Revert to pending so it can retry next polling cycle
                                timeline.milestones[i].status = 'pending';
                            }
                        }
                    }

                    // Update the timeline document if any milestones were triggered
                    // Use a transaction to prevent race with executeMilestoneFn
                    if (updated) {
                        const dueMilestoneIds = new Set(
                            timeline.milestones
                                .filter((m: TimelineMilestone) => m.status === 'executing')
                                .map((m: TimelineMilestone) => m.id)
                        );

                        await db.runTransaction(async (transaction) => {
                            const freshSnap = await transaction.get(timelineDoc.ref);
                            if (!freshSnap.exists) return;

                            const freshTimeline = freshSnap.data() as Timeline;
                            const freshMilestones = freshTimeline.milestones;

                            // Only update milestones that WE dispatched (don't overwrite executor changes)
                            for (let j = 0; j < freshMilestones.length; j++) {
                                if (dueMilestoneIds.has(freshMilestones[j].id) && freshMilestones[j].status === 'pending') {
                                    freshMilestones[j].status = 'executing';
                                }
                            }

                            const completedCount = freshMilestones.filter(
                                (m: TimelineMilestone) => m.status === 'completed'
                            ).length;

                            const allDone = freshMilestones.every(
                                (m: TimelineMilestone) => m.status === 'completed' || m.status === 'skipped' || m.status === 'failed'
                            );

                            const updates: Record<string, any> = {
                                milestones: freshMilestones,
                                updatedAt: now,
                                completedCount,
                            };

                            if (allDone) {
                                updates.status = 'completed';
                                console.log(`[pollTimelineMilestones] Timeline "${timeline.title}" is now completed!`);
                            }

                            transaction.update(timelineDoc.ref, updates);
                        });
                    }
                }
            }

            console.log(
                `[pollTimelineMilestones] Done. Found ${totalDue} due milestones, dispatched ${totalProcessed} to Inngest.`
            );
        } catch (error) {
            console.error('[pollTimelineMilestones] Fatal error:', error);
        }
    }
);
