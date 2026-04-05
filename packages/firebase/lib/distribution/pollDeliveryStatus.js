"use strict";
/**
 * Firebase Cloud Function: Poll Delivery Status
 *
 * Runs every hour to check the delivery status of pending releases and
 * update the `deliveryStatus` field in Firestore. Acts as the background
 * heartbeat for multi-distributor delivery tracking.
 *
 * Item 218: Delivery Status Polling & Webhooks.
 *
 * Architecture:
 * - Queries `releases` collection for documents with `deliveryStatus` in
 *   ['pending', 'processing', 'validating', 'in_review']
 * - For each pending delivery, checks the distributor-specific status endpoint
 *   if an API key is available; otherwise applies time-based heuristics
 * - Writes status updates + timestamps back to Firestore
 * - Triggers a Firestore write that client-side listeners can react to
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollDeliveryStatus = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
/** Statuses that are still in-flight and warrant polling */
const PENDING_STATUSES = ['pending', 'processing', 'validating', 'in_review', 'pending_review'];
/** Minimum hours a release must be in a pending state before we attempt a status check */
const MIN_HOURS_BEFORE_CHECK = 1;
/** Distributor-specific heuristic lead times (hours) */
const DISTRIBUTOR_LEAD_HOURS = {
    distrokid: 48,
    tunecore: 72,
    cdbaby: 240, // 10 days
    symphonic: 120, // 5 days
    unitedmasters: 72,
    onerpm: 168, // 7 days
    believe: 504, // 21 days
};
/**
 * Attempt to fetch delivery status from a distributor API.
 * Returns null if the distributor doesn't support status polling or
 * no API key is configured.
 */
async function checkDistributorStatus(distributorId, distributorReleaseId, apiKey) {
    var _a;
    if (!apiKey || !distributorReleaseId)
        return null;
    try {
        const endpoints = {
            tunecore: `https://api.tunecore.com/v1/releases/${distributorReleaseId}`,
            onerpm: `https://api.onerpm.com/v1/releases/${distributorReleaseId}`,
            unitedmasters: `https://api.unitedmasters.com/v1/releases/${distributorReleaseId}`,
        };
        const url = endpoints[distributorId];
        if (!url)
            return null;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        const rawStatus = data.status || data.state;
        // Normalize to internal status vocabulary
        const statusMap = {
            live: 'live',
            published: 'live',
            active: 'live',
            approved: 'live',
            in_review: 'in_review',
            reviewing: 'in_review',
            processing: 'processing',
            pending: 'pending',
            rejected: 'failed',
            failed: 'failed',
            error: 'failed',
        };
        return rawStatus ? ((_a = statusMap[rawStatus.toLowerCase()]) !== null && _a !== void 0 ? _a : null) : null;
    }
    catch (_b) {
        return null;
    }
}
/**
 * Apply time-based heuristics when no API status is available.
 * Transitions pending → in_review → live based on expected lead times.
 */
function applyStatusHeuristic(currentStatus, distributorId, deliveredAtMs) {
    var _a;
    if (!deliveredAtMs)
        return currentStatus;
    const hoursSinceDelivery = (Date.now() - deliveredAtMs) / (1000 * 60 * 60);
    const leadHours = (_a = DISTRIBUTOR_LEAD_HOURS[distributorId]) !== null && _a !== void 0 ? _a : 72;
    if (currentStatus === 'pending' || currentStatus === 'pending_review') {
        if (hoursSinceDelivery >= 2)
            return 'in_review';
    }
    if (currentStatus === 'in_review' || currentStatus === 'validating' || currentStatus === 'processing') {
        if (hoursSinceDelivery >= leadHours)
            return 'live';
    }
    return currentStatus;
}
/**
 * Scheduled Cloud Function — runs every hour.
 * Polls pending release deliveries and updates their status in Firestore.
 */
exports.pollDeliveryStatus = (0, scheduler_1.onSchedule)({
    schedule: 'every 60 minutes',
    timeoutSeconds: 300,
    memory: '256MiB',
    region: 'us-central1',
}, async (_event) => {
    const db = (0, firestore_1.getFirestore)();
    const now = Date.now();
    const cutoffMs = now - MIN_HOURS_BEFORE_CHECK * 60 * 60 * 1000;
    try {
        // Query all in-flight deliveries
        const snapshot = await db.collection('releases')
            .where('deliveryStatus', 'in', PENDING_STATUSES)
            .limit(100)
            .get();
        if (snapshot.empty) {
            firebase_functions_1.logger.info('[pollDeliveryStatus] No pending deliveries to check.');
            return;
        }
        firebase_functions_1.logger.info(`[pollDeliveryStatus] Checking ${snapshot.size} pending releases.`);
        const updates = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Skip if checked too recently
            if (data.lastStatusCheck && data.lastStatusCheck > cutoffMs) {
                continue;
            }
            const apiStatus = await checkDistributorStatus(data.distributorId, data.distributorReleaseId || '', data.apiKey);
            const newStatus = apiStatus !== null && apiStatus !== void 0 ? apiStatus : applyStatusHeuristic(data.deliveryStatus, data.distributorId, data.deliveredAt);
            if (newStatus !== data.deliveryStatus || !data.lastStatusCheck) {
                updates.push(doc.ref.update({
                    deliveryStatus: newStatus,
                    lastStatusCheck: now,
                    statusHistory: firestore_1.FieldValue.arrayUnion({
                        status: newStatus,
                        checkedAt: now,
                        source: apiStatus ? 'api' : 'heuristic',
                    }),
                }).then(() => {
                    firebase_functions_1.logger.info(`[pollDeliveryStatus] ${doc.id} (${data.distributorId}): ${data.deliveryStatus} → ${newStatus}`);
                }));
            }
            else {
                // Just update the heartbeat timestamp
                updates.push(doc.ref.update({ lastStatusCheck: now }).then(() => undefined));
            }
        }
        await Promise.allSettled(updates);
        firebase_functions_1.logger.info(`[pollDeliveryStatus] Completed. Processed ${updates.length} updates.`);
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        firebase_functions_1.logger.error({ message: '[pollDeliveryStatus] Error during status poll', errorCode: 'POLL_FAILED', detail: errMsg });
    }
});
//# sourceMappingURL=pollDeliveryStatus.js.map