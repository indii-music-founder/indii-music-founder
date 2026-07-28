import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

interface FraudAlert {
    trackId: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    detectedAt: string;
    fingerprint?: string;
}

/**
 * persistFraudAlert: Callable Cloud Function for persisting fraud alerts
 *
 * Replaces direct client-side writes to Firestore.
 * - Secures fraud_alerts collection by only allowing Admin SDK writes
 * - Enforces schema validation
 */
export const persistFraudAlert = onCall(
    { memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        // Require App Check
        if (request.app == undefined) {
            throw new HttpsError(
                'failed-precondition',
                'The function must be called from an App Check verified app.'
            );
        }

        // Require authentication
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "User must be authenticated to persist fraud alerts."
            );
        }

        const { trackId, severity, reason, detectedAt, fingerprint } = (request.data ?? {}) as FraudAlert;

        if (!trackId || !severity || !reason || !detectedAt) {
            throw new HttpsError(
                "invalid-argument",
                "Fraud alert missing required fields."
            );
        }

        const alertData: FraudAlert & { createdAt: admin.firestore.FieldValue, reportedBy: string } = {
            trackId,
            severity,
            reason,
            detectedAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            reportedBy: request.auth.uid,
        };

        if (fingerprint) {
            alertData.fingerprint = fingerprint;
        }

        try {
            const db = admin.firestore();
            await db.collection('fraud_alerts').add(alertData);
            return { success: true };
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error('[persistFraudAlert] Failed to persist to Firestore:', errorMsg);
            throw new HttpsError(
                "internal",
                `Failed to persist fraud alert: ${errorMsg}`
            );
        }
    }
);
