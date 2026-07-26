import * as functions from 'firebase-functions/v1';

import { requireVerifiedEmailV1, validateAppCheckV1 } from '../../middleware/appCheck';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../security/arcjet';

/**
 * Compatibility admission for V1 creative callables that have not yet moved
 * to the V2 gateway transport. It deliberately resolves all authority on the
 * server: an authenticated browser cannot choose a Founder/paid policy, and
 * a profile field is never an entitlement.
 */
export async function requireVerifiedCreativeAdmissionV1(
    context: functions.https.CallableContext,
    operation: string,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV1;
        requireVerifiedEmail?: typeof requireVerifiedEmailV1;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
        operationId?: () => string;
    } = {},
) {
    const validateAppCheck = dependencies.validateAppCheck ?? validateAppCheckV1;
    const requireVerifiedEmail = dependencies.requireVerifiedEmail ?? requireVerifiedEmailV1;
    const resolveEntitlement = dependencies.resolveEntitlement ?? requireVerifiedServerEntitlement;
    const protect = dependencies.protect ?? protectAuthenticatedApiRequest;
    const policyForEntitlement = dependencies.policyForEntitlement ?? policyClassForServerEntitlement;
    const operationId = dependencies.operationId ?? (() => crypto.randomUUID());

    validateAppCheck(context);
    const userId = requireVerifiedEmail(context);
    const entitlement = await resolveEntitlement(userId);
    if (!context.rawRequest) {
        throw new functions.https.HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protect(context.rawRequest as never, {
        userId,
        policy: policyForEntitlement({
            tier: entitlement.tier,
            isAdmin: context.auth?.token.admin === true,
        }),
        operationId: `${operation}:${operationId()}`,
    });
    if (!protection.allowed) {
        const code = protection.status === 429
            ? 'resource-exhausted'
            : protection.status === 403
                ? 'permission-denied'
                : 'unavailable';
        throw new functions.https.HttpsError(code, protection.message, {
            code: protection.code,
            ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
        });
    }
    return { userId, entitlement };
}
