import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

const db = getFirestore();

/**
 * ISWC Pending State Listener
 * Listens for PRO webhooks or manual updates to the ISWC field and triggers downstream distribution logic.
 */
export const onIswcAssigned = onDocumentUpdated("releases/{releaseId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return;

    // Check if ISWC transitioned from missing/PENDING to an actual value
    const wasPending = !beforeData.iswc || beforeData.iswc === 'PENDING';
    const isAssigned = afterData.iswc && afterData.iswc !== 'PENDING';

    if (wasPending && isAssigned) {
        console.log(`ISWC Assigned for Release ${event.params.releaseId}: ${afterData.iswc}`);
        
        // Unblock any pending distributions that required ISWC (e.g. Mechanical Licensing)
        const distributionStatusRef = db.collection('releases').doc(event.params.releaseId).collection('orchestration').doc('status');
        await distributionStatusRef.set({
            iswcAssigned: true,
            iswcAssignedAt: new Date().toISOString()
        }, { merge: true });

        // Trigger downstream orchestration here via PubSub or EventArc if needed
    }
});
