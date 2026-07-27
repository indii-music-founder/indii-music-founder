/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { defineSecret } from 'firebase-functions/params';

const inngestEventKey = defineSecret('INNGEST_EVENT_KEY');

const db = admin.firestore();

/**
 * ISSUE-1220: distinguish "Firestore index not provisioned" from a genuine
 * logic failure.
 *
 * Exported and pure so it can actually be tested — the handler itself is
 * wrapped in `onSchedule` and is not directly invocable from a unit test, which
 * is why this module had no coverage at all when the bug was found.
 *
 * A missing index surfaces as gRPC status 9 FAILED_PRECONDITION whose message
 * names an index; other FAILED_PRECONDITION errors (and every other error) must
 * NOT be reported as a provisioning problem, or the next real bug gets the
 * wrong diagnosis.
 */
export function isMissingIndexError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /FAILED_PRECONDITION/i.test(message) && /\bindex\b/i.test(message);
}

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
        const eventKey = inngestEventKey.value();
        if (!eventKey) {
            throw new Error('INNGEST_EVENT_KEY secret is not configured.');
        }
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
        // Cold start loads the whole bundled functions/index.js module graph,
        // which has grown past 256MiB (production logs: 266-279MiB observed) as
        // more functions/schemas were added elsewhere in the codebase. This
        // container was OOM-killed before it could bind its startup
        // health-check port on every scheduled run — see pollDeliveryStatus.ts
        // for the same fix and the sibling ERROR_LEDGER entry.
        memory: '512MiB',
        secrets: ['INNGEST_EVENT_KEY'],
    },
    async () => {
        const now = Date.now();
        console.log(`[pollTimelineMilestones] Checking for due milestones at ${new Date(now).toISOString()}`);

        let totalProcessed = 0;
        let totalDue = 0;
        const inngest = getInngest();

        try {
            // OPTIMIZATION: Use collectionGroup to find ALL active timelines across ALL users in one query
            // Requires a Firestore index: collectionGroup('items') with status == 'active'
            const activeTimelinesSnap = await db.collectionGroup('items')
                .where('status', '==', 'active')
                .get();

            console.log(`[pollTimelineMilestones] Found ${activeTimelinesSnap.size} active timelines across the platform.`);

            for (const timelineDoc of activeTimelinesSnap.docs) {
                // The parent doc id is the userId in our structure: timelines/{userId}/items/{timelineId}
                const userId = timelineDoc.ref.parent.parent?.id;
                if (!userId) {
                    console.warn(`[pollTimelineMilestones] Could not determine userId for timeline ${timelineDoc.id}`);
                    continue;
                }

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
            console.log(
                `[pollTimelineMilestones] Done. Found ${totalDue} due milestones, dispatched ${totalProcessed} to Inngest.`
            );
        } catch (error) {
            // ISSUE-1220: this handler used to log the raw Firestore stack trace
            // and then return normally, which reported SUCCESS to Cloud Scheduler
            // on a run that dispatched nothing. A missing index therefore looked
            // identical to "no milestones were due" — which is how this stayed
            // invisible from 2026-07-24 until it was traced by hand.
            //
            // A missing COLLECTION_GROUP index is a provisioning problem with a
            // specific, actionable fix, so name it instead of leaving the next
            // reader to decode a raw SDK error.
            const message = error instanceof Error ? error.message : String(error);

            if (isMissingIndexError(error)) {
                console.error(
                    '[pollTimelineMilestones] Firestore index not provisioned: the'
                    + " collectionGroup('items') query on `status` requires a"
                    + ' COLLECTION_GROUP-scoped index. It is declared in'
                    + ' packages/firebase/firestore.indexes.json (fieldOverrides ->'
                    + " items.status); if this still fires, the index exists in config"
                    + ' but has not finished building or was never deployed. No'
                    + ' milestones were dispatched on this run.',
                    message,
                );
            } else {
                console.error('[pollTimelineMilestones] Fatal error:', error);
            }

            // Fail the invocation. Swallowing this made a totally failed run
            // indistinguishable from a healthy no-op in Cloud Scheduler's own
            // status, which is the specific thing that hid this bug.
            throw error;
        }
    }
);
