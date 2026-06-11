import arcjet, { shield, slidingWindow, type ArcjetDecision } from "@arcjet/node";
import * as logger from "firebase-functions/logger";
import type { Request } from "firebase-functions/v2/https";

export type ArcjetProtectionResult =
    | { allowed: true }
    | {
        allowed: false;
        status: number;
        code: string;
        message: string;
    };

const arcjetKey = process.env.ARCJET_KEY;
const arcjetConfigured = typeof arcjetKey === "string" && arcjetKey.startsWith("ajkey_");
const productionRuntime = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);

const baseArcjet = arcjet({
    key: arcjetKey || "ajkey_missing_arcjet_key",
    rules: [
        shield({ mode: "LIVE" }),
    ],
});

const authenticatedApiArcjet = baseArcjet.withRule(
    slidingWindow({
        mode: "LIVE",
        characteristics: ["userId"],
        interval: "1m",
        max: 240,
    }),
);

const publicApiArcjet = baseArcjet.withRule(
    slidingWindow({
        mode: "LIVE",
        interval: "1m",
        max: 120,
    }),
);

function mapDecision(decision: ArcjetDecision): ArcjetProtectionResult {
    if (decision.isErrored()) {
        logger.warn("[Arcjet] Decision errored; allowing request", {
            decisionId: decision.id,
            reason: decision.reason.message,
        });
        return { allowed: true };
    }

    if (!decision.isDenied()) {
        return { allowed: true };
    }

    if (decision.reason.isRateLimit()) {
        return {
            allowed: false,
            status: 429,
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down.",
        };
    }

    return {
        allowed: false,
        status: 403,
        code: "REQUEST_BLOCKED",
        message: "Request blocked by security policy.",
    };
}

function missingArcjetKeyResult(): ArcjetProtectionResult {
    logger.error("[Arcjet] ARCJET_KEY is missing or invalid", {
        productionRuntime,
    });

    if (productionRuntime) {
        return {
            allowed: false,
            status: 503,
            code: "SECURITY_CONFIG_MISSING",
            message: "Request protection is not configured.",
        };
    }

    return { allowed: true };
}

export async function protectAuthenticatedApiRequest(
    req: Request,
    userId: string,
): Promise<ArcjetProtectionResult> {
    if (!arcjetConfigured) {
        return missingArcjetKeyResult();
    }

    try {
        const decision = await authenticatedApiArcjet.protect(req, { userId });
        return mapDecision(decision);
    } catch (error) {
        logger.error("[Arcjet] Authenticated API protection failed open", { error });
        return { allowed: true };
    }
}

export async function protectPublicApiRequest(req: Request): Promise<ArcjetProtectionResult> {
    if (!arcjetConfigured) {
        return missingArcjetKeyResult();
    }

    try {
        const decision = await publicApiArcjet.protect(req);
        return mapDecision(decision);
    } catch (error) {
        logger.error("[Arcjet] Public API protection failed open", { error });
        return { allowed: true };
    }
}
