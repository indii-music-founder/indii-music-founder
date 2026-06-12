import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * 90-Day Retention Daemon
 * Executes every 72 hours.
 * Verifies external placements. Flags as BLACKLISTED if removed before 90 days.
 */
export const retentionDaemon = onSchedule("every 72 hours", async (_event) => {
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
        let isDefinitivelyRemoved = false;
        let isTransientError = false;
        let statusCode = 0;
        
        try {
            // Programmatic HTTP GET query to audit external placement with a timeout
            const response = await fetch(placement.url, { method: 'GET', signal: AbortSignal.timeout(10000) });
            statusCode = response.status;
            
            if (response.status === 404) {
                isDefinitivelyRemoved = true;
            } else if (!response.ok) {
                isTransientError = true;
            }
        } catch (error) {
            console.error(`Failed to verify placement ${doc.id}:`, error);
            isTransientError = true;
        }

        if (isDefinitivelyRemoved) {
            console.log(`Placement ${doc.id} removed prematurely (404). Blacklisting vendor.`);
            const vendorRef = db.collection('vendors').doc(placement.vendorId);
            batch.update(vendorRef, { status: 'BLACKLISTED', blacklistedAt: new Date().toISOString() });
            batch.update(doc.ref, { status: 'VIOLATION_REMOVED', failureCount: 0 });
            updates++;
        } else if (isTransientError) {
            const currentFailures = (placement.failureCount ?? 0) + 1;
            console.warn(`Placement ${doc.id} failed verification (status: ${statusCode}). Failure count: ${currentFailures}`);
            if (currentFailures >= 3) {
                console.log(`Placement ${doc.id} reached maximum failure threshold. Blacklisting vendor.`);
                const vendorRef = db.collection('vendors').doc(placement.vendorId);
                batch.update(vendorRef, { status: 'BLACKLISTED', blacklistedAt: new Date().toISOString() });
                batch.update(doc.ref, { status: 'VIOLATION_REMOVED', failureCount: currentFailures });
                updates++;
            } else {
                batch.update(doc.ref, { failureCount: currentFailures });
                updates++;
            }
        } else {
            // Placement is active and healthy - reset failure count if previously set
            if (placement.failureCount && placement.failureCount > 0) {
                batch.update(doc.ref, { failureCount: 0 });
                updates++;
            }
        }
    }

    if (updates > 0) {
        await batch.commit();
        console.log(`Daemon completed. Blacklisted ${updates} non-compliant vendors.`);
    } else {
        console.log("Daemon completed. All audited placements compliant.");
    }
});
