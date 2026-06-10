import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * 90-Day Retention Daemon
 * Executes every 72 hours.
 * Verifies external placements. Flags as BLACKLISTED if removed before 90 days.
 */
export const retentionDaemon = onSchedule("every 72 hours", async (event) => {
    console.log("Starting 90-Day Retention Daemon check...");
    
    const placementsRef = db.collection('placements');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    // Query active placements that are younger than 90 days
    const snapshot = await placementsRef
        .where('status', '==', 'ACTIVE')
        .where('placedAt', '>', cutoffDate)
        .get();

    const batch = db.batch();
    let updates = 0;

    for (const doc of snapshot.docs) {
        const placement = doc.data();
        
        try {
            // Programmatic HTTP GET query to audit external placement
            // Node fetch is available in Node 18+
            const response = await fetch(placement.url, { method: 'GET' });
            
            if (!response.ok || response.status === 404) {
                console.log(`Placement ${doc.id} removed prematurely. Blacklisting vendor.`);
                
                // Blacklist the vendor network
                const vendorRef = db.collection('vendors').doc(placement.vendorId);
                batch.update(vendorRef, { status: 'BLACKLISTED', blacklistedAt: new Date().toISOString() });
                
                // Update placement status
                batch.update(doc.ref, { status: 'VIOLATION_REMOVED' });
                updates++;
            }
        } catch (error) {
            console.error(`Failed to verify placement ${doc.id}:`, error);
        }
    }

    if (updates > 0) {
        await batch.commit();
        console.log(`Daemon completed. Blacklisted ${updates} non-compliant vendors.`);
    } else {
        console.log("Daemon completed. All audited placements compliant.");
    }
});
