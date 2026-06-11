import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

type AuditSeverity = "low" | "medium" | "high" | "critical";

interface LogAuditEventRequest {
    action: string;
    resourceId: string;
    severity: AuditSeverity;
    details?: string;
}

const VALID_SEVERITIES = new Set<AuditSeverity>(["low", "medium", "high", "critical"]);

/**
 * logAuditEvent: callable backend writer for global audit_logs.
 *
 * The browser can request an audit event, but only Admin SDK writes the global
 * audit collection. This prevents client-side spoofing of userId, timestamp,
 * or source while preserving the existing SecurityTools workflow.
 */
export const logAuditEvent = functions.https.onCall(
    async (data: LogAuditEventRequest, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to write audit logs.",
            );
        }

        const { action, resourceId, severity, details } = data;
        if (
            typeof action !== "string" ||
            action.trim().length === 0 ||
            action.length > 160 ||
            typeof resourceId !== "string" ||
            resourceId.trim().length === 0 ||
            resourceId.length > 240 ||
            !VALID_SEVERITIES.has(severity)
        ) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Audit event missing required fields or contains invalid values.",
            );
        }

        if (details !== undefined && (typeof details !== "string" || details.length > 4_000)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Audit event details must be a string under 4000 characters.",
            );
        }

        const docRef = await admin.firestore().collection("audit_logs").add({
            action: action.trim(),
            resourceId: resourceId.trim(),
            severity,
            ...(details !== undefined ? { details } : {}),
            userId: context.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: "Agent_SecurityTools",
        });

        return {
            logId: docRef.id,
            action: action.trim(),
            resourceId: resourceId.trim(),
            severity,
            ...(details !== undefined ? { details } : {}),
        };
    },
);
