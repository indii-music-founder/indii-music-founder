import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

type AuditSeverity = "low" | "medium" | "high" | "critical";

interface LogAuditEventRequest {
    action: string;
    resourceId: string;
    severity: AuditSeverity;
    details?: string;
    agentId?: string;
    status?: "success" | "failure";
}

const VALID_SEVERITIES = new Set<AuditSeverity>(["low", "medium", "high", "critical"]);
const VALID_STATUSES = new Set(["success", "failure"]);

export async function persistAuditEvent(
    uid: string,
    data: LogAuditEventRequest,
): Promise<{
    logId: string;
    action: string;
    resourceId: string;
    severity: AuditSeverity;
    details?: string;
    agentId?: string;
    status: "success" | "failure";
}> {
    const { action, resourceId, severity, details, agentId, status = "success" } = data;
    if (
        typeof action !== "string" ||
        action.trim().length === 0 ||
        action.length > 160 ||
        typeof resourceId !== "string" ||
        resourceId.trim().length === 0 ||
        resourceId.length > 240 ||
        !VALID_SEVERITIES.has(severity) ||
        !VALID_STATUSES.has(status)
    ) {
        throw new HttpsError(
            "invalid-argument",
            "Audit event missing required fields or contains invalid values.",
        );
    }

    if (details !== undefined && (typeof details !== "string" || details.length > 4_000)) {
        throw new HttpsError(
            "invalid-argument",
            "Audit event details must be a string under 4000 characters.",
        );
    }

    if (agentId !== undefined && (typeof agentId !== "string" || agentId.trim().length === 0 || agentId.length > 120)) {
        throw new HttpsError(
            "invalid-argument",
            "Audit event agentId must be a non-empty string under 120 characters.",
        );
    }

    const normalizedAction = action.trim();
    const normalizedResourceId = resourceId.trim();
    const normalizedAgentId = agentId?.trim();
    const docRef = await admin.firestore().collection("audit_logs").add({
        action: normalizedAction,
        resourceId: normalizedResourceId,
        severity,
        status,
        ...(details !== undefined ? { details } : {}),
        ...(normalizedAgentId !== undefined ? { agentId: normalizedAgentId } : {}),
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: normalizedAgentId ? "Studio_Agent" : "Agent_SecurityTools",
    });

    return {
        logId: docRef.id,
        action: normalizedAction,
        resourceId: normalizedResourceId,
        severity,
        ...(details !== undefined ? { details } : {}),
        ...(normalizedAgentId !== undefined ? { agentId: normalizedAgentId } : {}),
        status,
    };
}

/**
 * logAuditEvent: callable backend writer for global audit_logs.
 *
 * The browser can request an audit event, but only Admin SDK writes the global
 * audit collection. This prevents client-side spoofing of userId, timestamp,
 * or source while preserving the existing SecurityTools workflow.
 */
export const logAuditEvent = onCall(
    { memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "User must be authenticated to write audit logs.",
            );
        }

        return persistAuditEvent(
            request.auth.uid,
            (request.data ?? {}) as LogAuditEventRequest,
        );
    },
);
