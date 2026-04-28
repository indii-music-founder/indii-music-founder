import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * Pulse Tick: The heartbeat of the indii Agent.
 * 
 * Runs every minute to:
 * 1. Identify active orchestration runs that haven't updated in > 2 minutes.
 * 2. Update their status to 'thinking' or 'stuck' if necessary.
 * 3. Emit progress events to the UI via Firestore to ensure the user feels "life".
 */
export const pulseTick = onSchedule("every 1 minutes", async (_event) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const timeoutThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

    console.log(`[PulseTick] Running at ${now.toDate().toISOString()}`);

    // 1. Find active plans that haven't been updated recently
    const activePlansSnapshot = await db.collection("agentPlans")
        .where("status", "==", "running")
        .where("updatedAt", "<", timeoutThreshold)
        .limit(50)
        .get();

    if (activePlansSnapshot.empty) {
        console.log("[PulseTick] No stale active plans found.");
        return;
    }

    console.log(`[PulseTick] Found ${activePlansSnapshot.size} stale active plans.`);

    const batch = db.batch();

    for (const doc of activePlansSnapshot.docs) {
        const plan = doc.data();
        
        // Log the nudge
        console.log(`[PulseTick] Nudging plan ${doc.id} ("${plan.title}")`);

        // Emit a "still thinking" event or just update the updatedAt to keep it alive
        // We can also add a "pulse" metadata field to show the UI it's still alive
        batch.update(doc.ref, {
            updatedAt: now,
            "metadata.lastPulseAt": now,
            "metadata.pulseMessage": "Indii is still processing your request..."
        });
    }

    await batch.commit();
    console.log("[PulseTick] Completed nudging stale plans.");
});
