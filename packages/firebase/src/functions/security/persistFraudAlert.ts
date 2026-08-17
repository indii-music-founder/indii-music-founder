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

interface FraudAlert {
    trackId: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason: string;
    detectedAt: string;
    fingerprint?: string;
}

/**
 * Admit a callable request to the fraud-alert writer.
 *
 * Mirrors the canonical admission chain used by sibling client-reachable
 * callables (see `admitOrganizationAccessRequest`): App Check, verified
 * email, server-owned entitlement, then Arcjet request protection with a
 * policy class derived only from backend state. Fail-closed on every stage.
 */
export async function admitFraudAlertWriteRequest(
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
        operationId: `fraud-alert-write:${randomUUID()}`,
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
 * persistFraudAlert: Callable Cloud Function for persisting fraud alerts
 *
 * Replaces direct client-side writes to Firestore.
 * - Secures fraud_alerts collection by only allowing Admin SDK writes
 * - Enforces schema validation
 */
export const persistFraudAlert = onCall(
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
        const uid = await admitFraudAlertWriteRequest(request);

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
            reportedBy: uid,
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
