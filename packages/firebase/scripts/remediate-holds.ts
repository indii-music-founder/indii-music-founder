import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ projectId: 'indii-music-founder' });
const db = getFirestore();

async function analyzeStaleHolds() {
    const now = Timestamp.now();
    console.log(`Starting dry-run analysis of stale cost_reservations at ${now.toDate().toISOString()}`);

    // Fetch up to 1000 expired, approved holds
    const snapshot = await db.collection('cost_reservations')
        .where('status', '==', 'APPROVED')
        .where('expiresAt', '<', now)
        .limit(1000)
        .get();

    console.log(`Found ${snapshot.size} stale holds in sample.`);

    let shapeA = 0; // Legacy holds (no metadata.jobId)
    let shapeB = 0; // Job missing or incomplete -> VOIDED
    let shapeC = 0; // Job complete -> SETTLED
    let other = 0;
    
    let totalValueVoided = 0;
    let totalValueSettled = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const jobId = data.metadata?.jobId;
        const amount = data.amount || 0;

        if (!jobId) {
            shapeA++;
            totalValueVoided += amount;
            continue; // Assume void for legacy
        }

        const jobRef = db.collection('jobs').doc(jobId);
        const jobSnap = await jobRef.get();

        if (!jobSnap.exists) {
            shapeB++;
            totalValueVoided += amount;
        } else {
            const jobStatus = jobSnap.data()?.status;
            if (jobStatus === 'COMPLETED') {
                shapeC++;
                totalValueSettled += amount;
            } else {
                shapeB++;
                totalValueVoided += amount;
            }
        }
    }

    console.log('\n--- Analysis Results ---');
    console.log(`Shape A (Legacy, no jobId): ${shapeA} (${(shapeA/snapshot.size*100).toFixed(1)}%) -> Will be VOIDED`);
    console.log(`Shape B (Job missing/incomplete): ${shapeB} (${(shapeB/snapshot.size*100).toFixed(1)}%) -> Will be VOIDED`);
    console.log(`Shape C (Job complete): ${shapeC} (${(shapeC/snapshot.size*100).toFixed(1)}%) -> Will be SETTLED`);
    console.log(`Other: ${other}`);
    
    console.log('\n--- Financial Impact (Sample) ---');
    console.log(`Total value to VOID (refund): ${totalValueVoided}`);
    console.log(`Total value to SETTLE (charge): ${totalValueSettled}`);
}

analyzeStaleHolds().catch(console.error);
