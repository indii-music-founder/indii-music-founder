import * as functions from "firebase-functions/v1";
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
export const persistFraudAlert = functions.https.onCall(
    async (data: FraudAlert, context) => {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to persist fraud alerts."
            );
        }

        const { trackId, severity, reason, detectedAt, fingerprint } = data;

        if (!trackId || !severity || !reason || !detectedAt) {
            throw new functions.https.HttpsError(
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
            reportedBy: context.auth.uid,
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
            throw new functions.https.HttpsError(
                "internal",
                `Failed to persist fraud alert: ${errorMsg}`
            );
        }
    }
);
