import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    arcjet: vi.fn(),
    anonymousProtect: vi.fn(),
    freeProtect: vi.fn(),
    paidProtect: vi.fn(),
    founderProtect: vi.fn(),
    adminProtect: vi.fn(),
    byoProtect: vi.fn(),
    shield: vi.fn(),
    slidingWindow: vi.fn(),
    withRule: vi.fn(),
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    loggerDebug: vi.fn(),
}));

vi.mock("@arcjet/node", () => ({
    default: mocks.arcjet,
    shield: mocks.shield,
    slidingWindow: mocks.slidingWindow,
}));

vi.mock("firebase-functions/logger", () => ({
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    debug: mocks.loggerDebug,
}));

type DecisionOptions = {
    denied?: boolean;
    errored?: boolean;
    rateLimit?: boolean;
    reset?: number;
};

const request = {
    method: "GET",
    url: "/api/health",
    headers: {
        host: "localhost",
    },
    socket: {
        encrypted: true,
    },
};

function mockDecision(options: DecisionOptions = {}) {
    return {
        id: "decision_test",
        isDenied: () => Boolean(options.denied),
        isErrored: () => Boolean(options.errored),
        reason: options.errored
            ? { message: "Arcjet service error" }
            : { isRateLimit: () => Boolean(options.rateLimit), reset: options.reset ?? 17 },
    };
}

async function loadArcjetModule() {
    return import("./arcjet");
}

describe("Arcjet request protection", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        process.env.ARCJET_KEY = "ajkey_test_key";
        delete process.env.K_SERVICE;
        delete process.env.NODE_ENV;

        mocks.shield.mockReturnValue({ kind: "shield" });
        mocks.slidingWindow.mockImplementation((options) => ({
            kind: "slidingWindow",
            options,
        }));

        const protectors = [
            mocks.anonymousProtect,
            mocks.freeProtect,
            mocks.paidProtect,
            mocks.founderProtect,
            mocks.adminProtect,
            mocks.byoProtect,
        ];
        let clientIndex = 0;
        mocks.withRule.mockImplementation(() => {
            const protect = protectors[clientIndex++]!;
            return { protect };
        });

        mocks.arcjet.mockReturnValue({ withRule: mocks.withRule });
        protectors.forEach(protect => protect.mockResolvedValue(mockDecision()));
    });

    it("creates a shared Arcjet client with shield and route-specific sliding windows", async () => {
        await loadArcjetModule();

        expect(mocks.arcjet).toHaveBeenCalledWith({
            key: "ajkey_test_key",
            rules: [{ kind: "shield" }],
        });
        expect(mocks.shield).toHaveBeenCalledWith({ mode: "LIVE" });
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(1, {
            mode: "LIVE",
            interval: "1m",
            max: 10,
        });
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(2, {
            mode: "LIVE",
            characteristics: ["userId"],
            interval: "1m",
            max: 20,
        });
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(3, expect.objectContaining({ max: 60 }));
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(4, expect.objectContaining({ max: 120 }));
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(5, expect.objectContaining({ max: 30 }));
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(6, expect.objectContaining({ max: 45 }));
    });

    it("allows a low-risk anonymous read when Arcjet allows it", async () => {
        const { protectAnonymousSignupRequest } = await loadArcjetModule();

        expect(mocks.arcjet).toHaveBeenCalledTimes(1);
        const result = await protectAnonymousSignupRequest(request as never, "operation-1", "allow-low-risk-read");
        expect(mocks.anonymousProtect).toHaveBeenCalledWith(request, { correlationId: "operation-1" });
        expect(result).toEqual({ allowed: true });
    });

    it("returns 429 when the authenticated per-user rate limit denies the request", async () => {
        mocks.freeProtect.mockResolvedValue(mockDecision({ denied: true, rateLimit: true, reset: 22 }));
        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        await expect(protectAuthenticatedApiRequest(request as never, {
            userId: "user_123",
            policy: "verified-free",
            operationId: "operation-1",
        })).resolves.toEqual({
            allowed: false,
            status: 429,
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down.",
            retryAfterSeconds: 22,
        });
        expect(mocks.freeProtect).toHaveBeenCalledWith(request, { userId: "user_123", correlationId: "operation-1" });
    });

    it("fails closed on a transient Arcjet service error for an authenticated operation", async () => {
        mocks.freeProtect.mockRejectedValue(new Error("network unavailable"));
        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        await expect(protectAuthenticatedApiRequest(request as never, {
            userId: "user_123",
            policy: "verified-free",
            operationId: "operation-1",
        })).resolves.toMatchObject({ allowed: false, status: 503, code: "SECURITY_UNAVAILABLE", retryAfterSeconds: 60 });
        expect(mocks.loggerWarn).toHaveBeenCalledWith("[Arcjet] Request protection unavailable", expect.objectContaining({
            policy: "verified-free",
            operationId: "operation-1",
            reason: "decision_error",
        }));
    });

    it("retries once on a transient timeout and allows the request when the retry succeeds (ISSUE-1360)", async () => {
        mocks.freeProtect
            .mockRejectedValueOnce(new Error("[deadline_exceeded] the operation timed out"))
            .mockResolvedValueOnce(mockDecision({ denied: false }));
        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        const result = await protectAuthenticatedApiRequest(request as never, {
            userId: "user_123",
            policy: "verified-free",
            operationId: "operation-1",
        });

        expect(result).toEqual({ allowed: true });
        expect(mocks.freeProtect).toHaveBeenCalledTimes(2);
        expect(mocks.freeProtect).toHaveBeenLastCalledWith(request, { userId: "user_123", correlationId: "operation-1" });
    });

    it("does not retry non-transient errors (bad key, malformed request)", async () => {
        mocks.freeProtect.mockRejectedValue(new Error("invalid api key"));
        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        await expect(protectAuthenticatedApiRequest(request as never, {
            userId: "user_123",
            policy: "verified-free",
            operationId: "operation-1",
        })).resolves.toMatchObject({ allowed: false, status: 503, code: "SECURITY_UNAVAILABLE" });
        expect(mocks.freeProtect).toHaveBeenCalledTimes(1);
    });

    it("fails closed when ARCJET_KEY is missing, regardless of runtime mode", async () => {
        delete process.env.ARCJET_KEY;

        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        await expect(protectAuthenticatedApiRequest(request as never, {
            userId: "user_123",
            policy: "verified-free",
            operationId: "operation-1",
        })).resolves.toEqual({
            allowed: false,
            status: 503,
            code: "SECURITY_UNAVAILABLE",
            message: "Request protection is temporarily unavailable.",
            retryAfterSeconds: 60,
        });
        expect(mocks.freeProtect).not.toHaveBeenCalled();
        expect(mocks.loggerError).toHaveBeenCalledWith(
            "[Arcjet] Request protection unavailable",
            expect.objectContaining({ policy: "verified-free", reason: "missing_configuration" }),
        );
    });

    it("allows only the documented low-risk read to degrade when the secret is missing", async () => {
        delete process.env.ARCJET_KEY;
        const { protectAnonymousSignupRequest } = await loadArcjetModule();

        await expect(protectAnonymousSignupRequest(request as never, "health-1", "allow-low-risk-read"))
            .resolves.toEqual({ allowed: true, degraded: true });
    });

    it("derives policy classes only from backend entitlement and administrative state", async () => {
        const { policyClassForServerEntitlement } = await loadArcjetModule();
        const { SubscriptionTier } = await import("../../shared/subscription/types");

        expect(policyClassForServerEntitlement({ tier: SubscriptionTier.FREE, isAdmin: false })).toBe("verified-free");
        expect(policyClassForServerEntitlement({ tier: SubscriptionTier.PRO_MONTHLY, isAdmin: false })).toBe("paid");
        expect(policyClassForServerEntitlement({ tier: SubscriptionTier.FOUNDER, isAdmin: false })).toBe("founder");
        expect(policyClassForServerEntitlement({ tier: SubscriptionTier.FREE, isAdmin: true })).toBe("admin");
        expect(policyClassForServerEntitlement({ tier: SubscriptionTier.FREE, isAdmin: false, bringYourOwnApiEnabled: true })).toBe("byo-api");
    });
});
