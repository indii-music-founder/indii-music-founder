import arcjet, { shield, slidingWindow, type ArcjetDecision } from "@arcjet/node";
import * as logger from "firebase-functions/logger";
import type { Request } from "firebase-functions/v2/https";

import { SubscriptionTier } from "../../shared/subscription/types";

export type ArcjetPolicyClass =
    | "anonymous-signup"
    | "verified-free"
    | "paid"
    | "founder"
    | "admin"
    | "byo-api";

type AuthenticatedArcjetPolicyClass = Exclude<ArcjetPolicyClass, "anonymous-signup">;
export type ArcjetFailureMode = "fail-closed" | "allow-low-risk-read";

export interface ServerOwnedArcjetPolicyInput {
    tier: SubscriptionTier;
    isAdmin: boolean;
    bringYourOwnApiEnabled?: boolean;
}

export interface AuthenticatedArcjetRequestContext {
    userId: string;
    policy: AuthenticatedArcjetPolicyClass;
    operationId: string;
}

export type ArcjetProtectionResult =
    | { allowed: true; degraded?: true }
    | {
        allowed: false;
        status: number;
        code: string;
        message: string;
        retryAfterSeconds?: number;
    };

const configuredArcjetKey = (() => {
    const key = process.env.ARCJET_KEY;
    return typeof key === "string" && key.startsWith("ajkey_") ? key : undefined;
})();

// No fake fallback key: an unavailable security control must remain visible as
// an unavailable security control. Functions receive this secret only through
// Firebase's `secrets` deployment option.
const baseArcjet = configuredArcjetKey
    ? arcjet({ key: configuredArcjetKey, rules: [shield({ mode: "LIVE" })] })
    : undefined;

const anonymousSignupArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        interval: "1m",
        max: 10,
    }),
);

const verifiedFreeArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 20,
    }),
);

const paidArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 60,
    }),
);

const founderArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 120,
    }),
);

const adminArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 30,
    }),
);

const byoApiArcjet = baseArcjet?.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 45,
    }),
);

function authenticatedClient(policy: AuthenticatedArcjetPolicyClass) {
    switch (policy) {
        case "verified-free":
            return verifiedFreeArcjet;
        case "paid":
            return paidArcjet;
        case "founder":
            return founderArcjet;
        case "admin":
            return adminArcjet;
        case "byo-api":
            return byoApiArcjet;
    }
}

/** Maps only backend-authenticated entitlement and administrative state to a policy. */
export function policyClassForServerEntitlement(input: ServerOwnedArcjetPolicyInput): AuthenticatedArcjetPolicyClass {
    if (input.isAdmin) return "admin";
    if (input.bringYourOwnApiEnabled === true) return "byo-api";
    if (input.tier === SubscriptionTier.FOUNDER) return "founder";
    if (input.tier === SubscriptionTier.PRO_MONTHLY || input.tier === SubscriptionTier.PRO_YEARLY || input.tier === SubscriptionTier.STUDIO) {
        return "paid";
    }
    return "verified-free";
}

function securityUnavailableResult(
    policy: ArcjetPolicyClass,
    operationId: string,
    failureMode: ArcjetFailureMode,
    reason: "missing_configuration" | "decision_error",
): ArcjetProtectionResult {
    const log = reason === "missing_configuration" ? logger.error : logger.warn;
    log("[Arcjet] Request protection unavailable", {
        policy,
        operationId,
        reason,
    });
    if (failureMode === "allow-low-risk-read") return { allowed: true, degraded: true };
    return {
        allowed: false,
        status: 503,
        code: "SECURITY_UNAVAILABLE",
        message: "Request protection is temporarily unavailable.",
        retryAfterSeconds: 60,
    };
}

function mapDecision(
    decision: ArcjetDecision,
    policy: ArcjetPolicyClass,
    operationId: string,
    failureMode: ArcjetFailureMode,
): ArcjetProtectionResult {
    if (decision.isErrored()) {
        logger.warn("[Arcjet] Decision failed", {
            decisionId: decision.id,
            policy,
            operationId,
        });
        return securityUnavailableResult(policy, operationId, failureMode, "decision_error");
    }

    if (!decision.isDenied()) {
        logger.debug("[Arcjet] Request allowed", {
            decisionId: decision.id,
            policy,
            operationId,
        });
        return { allowed: true };
    }

    if (decision.reason.isRateLimit()) {
        const retryAfterSeconds = Number.isFinite(decision.reason.reset) && decision.reason.reset > 0
            ? Math.ceil(decision.reason.reset)
            : 60;
        logger.warn("[Arcjet] Request rate limited", {
            decisionId: decision.id,
            policy,
            operationId,
            retryAfterSeconds,
        });
        return {
            allowed: false,
            status: 429,
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down.",
            retryAfterSeconds,
        };
    }

    logger.warn("[Arcjet] Request blocked", {
        decisionId: decision.id,
        policy,
        operationId,
    });
    return {
        allowed: false,
        status: 403,
        code: "REQUEST_BLOCKED",
        message: "Request blocked by security policy.",
    };
}

export async function protectAuthenticatedApiRequest(
    req: Request,
    context: AuthenticatedArcjetRequestContext,
): Promise<ArcjetProtectionResult> {
    const client = authenticatedClient(context.policy);
    if (!client) {
        return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "missing_configuration");
    }
    try {
        const decision = await client.protect(req, {
            userId: context.userId,
            correlationId: context.operationId,
        });
        return mapDecision(decision, context.policy, context.operationId, "fail-closed");
    } catch (_error) {
        return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
    }
}

/**
 * Anonymous endpoints are limited by Arcjet's request characteristics (IP by
 * default). The only permitted degradation is an explicitly low-risk read,
 * such as the unauthenticated liveness endpoint.
 */
export async function protectAnonymousSignupRequest(
    req: Request,
    operationId: string,
    failureMode: ArcjetFailureMode = "fail-closed",
): Promise<ArcjetProtectionResult> {
    if (!anonymousSignupArcjet) {
        return securityUnavailableResult("anonymous-signup", operationId, failureMode, "missing_configuration");
    }
    try {
        const decision = await anonymousSignupArcjet.protect(req, { correlationId: operationId });
        return mapDecision(decision, "anonymous-signup", operationId, failureMode);
    } catch (_error) {
        return securityUnavailableResult("anonymous-signup", operationId, failureMode, "decision_error");
    }
}
