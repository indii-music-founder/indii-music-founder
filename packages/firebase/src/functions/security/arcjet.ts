import arcjet, { shield, slidingWindow, type ArcjetDecision } from "@arcjet/node";
import * as logger from "firebase-functions/logger";
import type { Request } from "firebase-functions/v2/https";

import { enforceRateLimit } from "../../lib/rateLimit";
import { canUseOwnerQuotaContinuity, isProviderQuotaExhaustion } from "./ownerQuotaContinuity";

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

export interface LocalRateLimitConfig {
    /** Stable per-user rate limit bucket name; must never include random per-request IDs. */
    bucket: string;
    maxRequests: number;
    windowMs: number;
}

export interface AuthenticatedArcjetRequestContext {
    userId: string;
    policy: AuthenticatedArcjetPolicyClass;
    operationId: string;
    /** Set only from verified Firebase token claims, never request data. */
    ownerQuotaContinuity?: boolean;
    /**
     * Defaults to `"arcjet"`. Callers already gated by Firebase Auth, App Check,
     * and server-verified leases or ownership can use `"local-rate-limit"` to
     * enforce the Firestore distributed limiter without consuming Arcjet quota.
     */
    mode?: "arcjet" | "local-rate-limit";
    rateLimit?: LocalRateLimitConfig;
}

export interface AnonymousArcjetRequestOptions {
    mode?: "arcjet" | "local-rate-limit";
    rateLimit?: LocalRateLimitConfig;
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
    if (
        input.tier === SubscriptionTier.START ||
        input.tier === SubscriptionTier.BUILD ||
        input.tier === SubscriptionTier.SCALE ||
        input.tier === SubscriptionTier.PRO_MONTHLY ||
        input.tier === SubscriptionTier.PRO_YEARLY ||
        input.tier === SubscriptionTier.STUDIO
    ) {
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

function decisionErrorMessage(decision: ArcjetDecision): string {
    const reason = decision.reason as unknown as { message?: unknown };
    return typeof reason?.message === "string" ? reason.message : String(decision.reason);
}

function isTransientArcjetFailure(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes("deadline")
        || lower.includes("timeout")
        || lower.includes("econnreset")
        || lower.includes("fetch failed")
        || lower.includes("socket");
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
        logger.error("[Arcjet] Decision failed", {
            decisionId: decision.id,
            policy,
            operationId,
            err_msg: decisionErrorMessage(decision),
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

    // ISSUE-1711: name the rule that denied the request (SHIELD, BOT, ...);
    // without it a false positive cannot be told apart from real abuse.
    logger.warn("[Arcjet] Request blocked", {
        decisionId: decision.id,
        policy,
        operationId,
        reasonType: decision.reason.type,
    });
    return {
        allowed: false,
        status: 403,
        code: "REQUEST_BLOCKED",
        message: "Request blocked by security policy.",
    };
}

// Provider quota is distinct from an actual abuse denial. When Arcjet's monthly
// request allowance is exhausted, authenticated callers fall back to the
// distributed Firestore rate limiter rather than failing closed with 503.
let quotaUnavailableUntil = 0;

function defaultLocalRateLimit(policy: AuthenticatedArcjetPolicyClass): LocalRateLimitConfig {
    switch (policy) {
        case "paid":
        case "byo-api":
        case "admin":
            return { bucket: `local:${policy}`, maxRequests: 60, windowMs: 60_000 };
        case "founder":
            return { bucket: "local:founder", maxRequests: 120, windowMs: 60_000 };
        case "verified-free":
        default:
            return { bucket: "local:verified-free", maxRequests: 30, windowMs: 60_000 };
    }
}

async function enforceLocalRateLimitResult(params: {
    subjectKey: string;
    policy: ArcjetPolicyClass;
    operationId: string;
    rateLimit: LocalRateLimitConfig;
    failureMode: ArcjetFailureMode;
    degradedOnAllow?: boolean;
    limiterLabel: string;
}): Promise<ArcjetProtectionResult> {
    try {
        await enforceRateLimit(params.subjectKey, params.rateLimit.bucket, {
            maxRequests: params.rateLimit.maxRequests,
            windowMs: params.rateLimit.windowMs,
        });
        return params.degradedOnAllow ? { allowed: true, degraded: true } : { allowed: true };
    } catch (error) {
        if ((error as { code?: string })?.code === "resource-exhausted") {
            const retryAfterSeconds = Math.max(1, Math.ceil(params.rateLimit.windowMs / 1000));
            logger.warn(`[Security] ${params.limiterLabel} rate limit exceeded`, {
                operationId: params.operationId,
                policy: params.policy,
                bucket: params.rateLimit.bucket,
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
        logger.error(`[Security] ${params.limiterLabel} unavailable`, {
            operationId: params.operationId,
            policy: params.policy,
            bucket: params.rateLimit.bucket,
        });
        return securityUnavailableResult(params.policy, params.operationId, params.failureMode, "decision_error");
    }
}

async function protectDuringQuotaOutage(
    context: AuthenticatedArcjetRequestContext,
    continuityEligible: boolean,
): Promise<ArcjetProtectionResult> {
    // Shared per-user budget across all functions and instances.
    // Never key this counter by random per-request operationId.
    const bucket = continuityEligible ? "owner-quota-continuity" : "provider-quota-continuity";
    return enforceLocalRateLimitResult({
        subjectKey: context.userId,
        policy: context.policy,
        operationId: context.operationId,
        rateLimit: { bucket, maxRequests: 30, windowMs: 60_000 },
        failureMode: "fail-closed",
        degradedOnAllow: true,
        limiterLabel: "Quota continuity limiter",
    });
}

export async function protectAuthenticatedApiRequest(
    req: Request,
    context: AuthenticatedArcjetRequestContext,
): Promise<ArcjetProtectionResult> {
    if (context.mode === "local-rate-limit") {
        return enforceLocalRateLimitResult({
            subjectKey: context.userId,
            policy: context.policy,
            operationId: context.operationId,
            rateLimit: context.rateLimit ?? defaultLocalRateLimit(context.policy),
            failureMode: "fail-closed",
            limiterLabel: "Local rate limiter",
        });
    }
    const client = authenticatedClient(context.policy);
    if (!client) {
        return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "missing_configuration");
    }
    const continuityEligible = canUseOwnerQuotaContinuity(context.ownerQuotaContinuity, context.operationId);
    if (quotaUnavailableUntil > Date.now()) {
        return protectDuringQuotaOutage(context, continuityEligible);
    }
    // ISSUE-1360: a single transient Arcjet API timeout (deadline_exceeded)
    // previously blocked a legitimate paid operation (e.g. the cost-control
    // gate during annotation refine) with a fail-closed SECURITY_UNAVAILABLE.
    // The decision stays fail-closed — a retry that also fails still blocks —
    // but bounded retries with short backoff absorb external decision-service
    // blips (observed outage windows of 10-25s on 2026-08-19 14:25 and 21:48:
    // repeated '[Arcjet] Decision failed' while the service recovered).
    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const decision = await client.protect(req, {
                userId: context.userId,
                correlationId: context.operationId,
            });
            if (decision.isErrored()) {
                const errMsg = decisionErrorMessage(decision);
                logger.error("[Arcjet] Decision failed", {
                    decisionId: decision.id,
                    policy: context.policy,
                    operationId: context.operationId,
                    attempt: attempt + 1,
                    err_msg: errMsg,
                });
                if (isProviderQuotaExhaustion(errMsg)) {
                    quotaUnavailableUntil = Date.now() + 5 * 60_000;
                    logger.warn('[Security] Provider quota exhausted; using distributed rate-limit fallback', {
                        operationId: context.operationId,
                        policy: context.policy,
                        continuityEligible,
                    });
                    return protectDuringQuotaOutage(context, continuityEligible);
                }
                if (attempt < attempts - 1 && isTransientArcjetFailure(errMsg)) {
                    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
                    continue;
                }
                return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
            }
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
            const message = error instanceof Error ? error.message : String(error);
            if (isProviderQuotaExhaustion(message)) {
                quotaUnavailableUntil = Date.now() + 5 * 60_000;
                logger.warn("[Security] Provider quota exhausted; using distributed rate-limit fallback", {
                    operationId: context.operationId,
                    policy: context.policy,
                    continuityEligible,
                });
                return protectDuringQuotaOutage(context, continuityEligible);
            }
            if (attempt < attempts - 1) {
                // Transient timeout/connectivity blip: retry with backoff.
                // Non-transient errors (bad key, malformed request) fail
                // immediately without burning the retries.
                if (!isTransientArcjetFailure(message)) return securityUnavailableResult(context.policy, context.operationId, "fail-closed", "decision_error");
                await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
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
    options?: AnonymousArcjetRequestOptions,
): Promise<ArcjetProtectionResult> {
    if (options?.mode === "local-rate-limit") {
        const rawIp = typeof req?.ip === "string" && req.ip.trim().length > 0 ? req.ip.trim() : "anonymous";
        const clientIp = rawIp.replace(/[^a-zA-Z0-9.:_-]/g, "_");
        return enforceLocalRateLimitResult({
            subjectKey: `anon:${clientIp}`,
            policy: "anonymous-signup",
            operationId,
            rateLimit: options.rateLimit ?? { bucket: "anonymous-local", maxRequests: 60, windowMs: 60_000 },
            failureMode,
            limiterLabel: "Anonymous local rate limiter",
        });
    }
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
