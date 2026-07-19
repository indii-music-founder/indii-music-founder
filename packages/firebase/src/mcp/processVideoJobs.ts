import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export const processVideoJobs = functions.firestore.onDocumentCreated('videoJobs/{jobId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    console.log(`[MCP Job] Processing video job ${event.params.jobId} for user ${data.initiatorUid}`);

    // Simulate work (e.g. Remotion API calls)
    await new Promise(resolve => setTimeout(resolve, 1000));

    await snapshot.ref.update({
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
});
