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
        // ISSUE-1242: this logged only the decision id, discarding the reason —
        // so an errored decision said "something went wrong" and nothing more.
        // Arcjet carries the actual cause on `decision.reason` for an errored
        // decision (bad key, unreachable API, malformed request), and without it
        // a total outage is undiagnosable from logs. Escalated to `error`
        // severity too: every authenticated request is being denied, which is
        // not a warning-level event.
        const reason = decision.reason as unknown as { message?: unknown };
        logger.error("[Arcjet] Decision failed", {
            decisionId: decision.id,
            policy,
            operationId,
            err_msg: typeof reason?.message === "string" ? reason.message : String(decision.reason),
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
    // ISSUE-1360: a single transient Arcjet API timeout (deadline_exceeded)
    // previously blocked a legitimate paid operation (e.g. the cost-control
    // gate during annotation refine) with a fail-closed SECURITY_UNAVAILABLE.
    // The decision stays fail-closed — a retry that also fails still blocks —
    // but one bounded retry absorbs a blip in the external decision service.
    const attempts = 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const decision = await client.protect(req, {
                userId: context.userId,
                correlationId: context.operationId,
            });
            return mapDecision(decision, context.policy, context.operationId, "fail-closed");
        } catch (error) {
            // ISSUE-1242: this catch previously discarded the error entirely
            // (`catch (_error)`), so a persistent `decision_error` was
            // indistinguishable from a transient one and gave no cause. That
            // blindness is what made a total production outage undiagnosable from
            // logs — the only signal was "Request protection is temporarily
            // unavailable" with nothing behind it. Log the cause; never the key.
            logger.error("[Arcjet] Protect call threw", {
                policy: context.policy,
                operationId: context.operationId,
                attempt: attempt + 1,
                err_name: error instanceof Error ? error.name : typeof error,
                err_msg: error instanceof Error ? error.message : String(error),
                err_cause: (error as { cause?: unknown })?.cause !== undefined ? String((error as { cause?: unknown }).cause) : undefined,
                err_stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
            });
            if (attempt < attempts - 1) {
                // Transient timeout/connectivity blip: retry once. Non-transient
                // errors (bad key, malformed request) fail immediately without
                // burning the retry.
                const lower = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
                const transient = lower.includes("deadline") || lower.includes("timeout") || lower.includes("econnreset") || lower.includes("fetch failed") || lower.includes("socket");
                if (!transient) return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
                continue;
            }
            return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
        }
    }
    return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
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
    } catch (error) {
        // ISSUE-1242: same discarded-error problem as the authenticated path.
        logger.error("[Arcjet] Signup protect call threw", {
            operationId,
            err_name: error instanceof Error ? error.name : typeof error,
            err_msg: error instanceof Error ? error.message : String(error),
            err_cause: (error as { cause?: unknown })?.cause !== undefined ? String((error as { cause?: unknown }).cause) : undefined,
        });
        return securityUnavailableResult("anonymous-signup", operationId, failureMode, "decision_error");
    }
}
