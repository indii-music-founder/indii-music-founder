import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * onMilestoneScheduled: Real-time UI notification for scheduled tasks.
 * 
 * Triggered when a milestone is created or updated with a 'scheduledAt' timestamp.
 * Informs the UI that a task is queued and waiting for its execution slot.
 */
export const onMilestoneScheduled = functions
    .firestore.document("projects/{projectId}/milestones/{milestoneId}")
    .onWrite(async (change, context) => {
        const { projectId, milestoneId } = context.params;
        const before = change.before.data();
        const after = change.after.data();

        // If deleted, ignore
        if (!after) return;

        // Check if scheduledAt was just set or changed
        const wasScheduled = !before?.scheduledAt && after.scheduledAt;
        const scheduleChanged = before?.scheduledAt && after.scheduledAt && !before.scheduledAt.isEqual(after.scheduledAt);

        if (wasScheduled || scheduleChanged) {
            console.log(`[MilestoneScheduled] Milestone ${milestoneId} in project ${projectId} scheduled for ${after.scheduledAt.toDate().toISOString()}`);

            // Add a "scheduled" pulse to the project's agent state to notify the UI
            // This allows the TaskPlanWidget to show "Queued for [Time]"
            await admin.firestore().collection("projects").doc(projectId).update({
                "agentState.lastScheduledMilestone": {
                    id: milestoneId,
                    title: after.title,
                    scheduledAt: after.scheduledAt,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }
            });
        }
    });
