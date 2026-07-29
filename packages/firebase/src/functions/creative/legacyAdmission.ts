import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import { requireVerifiedEmailV2, validateAppCheckV2 } from '../../middleware/appCheck';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../security/arcjet';

/**
 * Shared admission for the legacy creative callables that have not yet moved
 * to the V2 gateway transport. It deliberately resolves all authority on the
 * server: an authenticated browser cannot choose a Founder/paid policy, and
 * a profile field is never an entitlement.
 *
 * Named ...V1 while the callables it served were Gen1; they are Gen2 now
 * (ISSUE-1243), so the suffix was dropped. "Legacy" here means the older
 * transport, not the function generation.
 */
export async function requireVerifiedCreativeAdmission(
    request: CallableRequest,
    operation: string,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        requireVerifiedEmail?: typeof requireVerifiedEmailV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
        operationId?: () => string;
    } = {},
) {
    const validateAppCheck = dependencies.validateAppCheck ?? validateAppCheckV2;
    const requireVerifiedEmail = dependencies.requireVerifiedEmail ?? requireVerifiedEmailV2;
    const resolveEntitlement = dependencies.resolveEntitlement ?? requireVerifiedServerEntitlement;
    const protect = dependencies.protect ?? protectAuthenticatedApiRequest;
    const policyForEntitlement = dependencies.policyForEntitlement ?? policyClassForServerEntitlement;
    const operationId = dependencies.operationId ?? (() => crypto.randomUUID());

    validateAppCheck(request);
    const userId = requireVerifiedEmail(request);
    const entitlement = await resolveEntitlement(userId);
    if (!request.rawRequest) {
        throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protect(request.rawRequest as never, {
        userId,
        policy: policyForEntitlement({
            tier: entitlement.tier,
            isAdmin: request.auth?.token.admin === true,
        }),
        operationId: `${operation}:${operationId()}`,
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
    return { userId, entitlement };
}
