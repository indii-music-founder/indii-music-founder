import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";

import { arcjetKey } from "../../config/secrets";
import { validateAppCheckV2, requireVerifiedEmailV2 } from "../../middleware/appCheck";
import { requireVerifiedServerEntitlement } from "../auth/entitlements";
import {
    policyClassForServerEntitlement,
    protectAuthenticatedApiRequest,
} from "./arcjet";

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
 * Admit a callable request to the audit-log writer.
 *
 * Mirrors the canonical admission chain used by sibling client-reachable
 * callables (see `admitOrganizationAccessRequest`): App Check, verified
 * email, server-owned entitlement, then Arcjet request protection with a
 * policy class derived only from backend state. Fail-closed on every stage.
 */
export async function admitAuditLogWriteRequest(
    request: CallableRequest<unknown>,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        requireVerifiedEmail?: typeof requireVerifiedEmailV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
    } = {},
): Promise<string> {
    const validateAppCheck = dependencies.validateAppCheck ?? validateAppCheckV2;
    const requireVerifiedEmail = dependencies.requireVerifiedEmail ?? requireVerifiedEmailV2;
    const resolveEntitlement = dependencies.resolveEntitlement ?? requireVerifiedServerEntitlement;
    const protect = dependencies.protect ?? protectAuthenticatedApiRequest;
    const policyForEntitlement = dependencies.policyForEntitlement ?? policyClassForServerEntitlement;

    validateAppCheck(request);
    const uid = requireVerifiedEmail(request);
    const entitlement = await resolveEntitlement(uid);
    if (!request.rawRequest) {
        throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protect(request.rawRequest as never, {
        userId: uid,
        policy: policyForEntitlement({
            tier: entitlement.tier,
            isAdmin: request.auth?.token.admin === true,
        }),
        operationId: `audit-log-write:${randomUUID()}`,
    });
    if (!protection.allowed) {
        const code = protection.status === 429
            ? 'resource-exhausted'
            : protection.status === 403
                ? 'permission-denied'
                : 'unavailable';
        throw new HttpsError(code, protection.message, {
            code: protection.code,
            ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
        });
    }
    return uid;
}

/**
 * logAuditEvent: callable backend writer for global audit_logs.
 *
 * The browser can request an audit event, but only Admin SDK writes the global
 * audit collection. This prevents client-side spoofing of userId, timestamp,
 * or source while preserving the existing SecurityTools workflow.
 */
export const logAuditEvent = onCall(
    {
        memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
        region: 'us-central1',
        timeoutSeconds: 15,
        secrets: [arcjetKey],
        enforceAppCheck: true,
    },
    async (request) => {
        const uid = await admitAuditLogWriteRequest(request);
        return persistAuditEvent(
            uid,
            (request.data ?? {}) as LogAuditEventRequest,
        );
    },
);
