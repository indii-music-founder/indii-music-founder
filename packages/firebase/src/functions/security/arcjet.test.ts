import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    arcjet: vi.fn(),
    authProtect: vi.fn(),
    publicProtect: vi.fn(),
    shield: vi.fn(),
    slidingWindow: vi.fn(),
    withRule: vi.fn(),
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
}));

vi.mock("@arcjet/node", () => ({
    default: mocks.arcjet,
    shield: mocks.shield,
    slidingWindow: mocks.slidingWindow,
}));

vi.mock("firebase-functions/logger", () => ({
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
}));

type DecisionOptions = {
    denied?: boolean;
    errored?: boolean;
    rateLimit?: boolean;
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
            : { isRateLimit: () => Boolean(options.rateLimit) },
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

        let clientIndex = 0;
        mocks.withRule.mockImplementation(() => {
            clientIndex += 1;
            return clientIndex === 1
                ? { protect: mocks.authProtect }
                : { protect: mocks.publicProtect };
        });

        mocks.arcjet.mockReturnValue({ withRule: mocks.withRule });
        mocks.authProtect.mockResolvedValue(mockDecision());
        mocks.publicProtect.mockResolvedValue(mockDecision());
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
            characteristics: ["userId"],
            interval: "1m",
            max: 240,
        });
        expect(mocks.slidingWindow).toHaveBeenNthCalledWith(2, {
            mode: "LIVE",
            interval: "1m",
            max: 120,
        });
    });

    it("allows a public request when Arcjet allows it", async () => {
        const { protectPublicApiRequest } = await loadArcjetModule();

        await expect(protectPublicApiRequest(request as never)).resolves.toEqual({ allowed: true });
        expect(mocks.publicProtect).toHaveBeenCalledWith(request);
    });

    it("returns 429 when the authenticated per-user rate limit denies the request", async () => {
        mocks.authProtect.mockResolvedValue(mockDecision({ denied: true, rateLimit: true }));
        const { protectAuthenticatedApiRequest } = await loadArcjetModule();

        await expect(protectAuthenticatedApiRequest(request as never, "user_123")).resolves.toEqual({
            allowed: false,
            status: 429,
            code: "RATE_LIMITED",
            message: "Too many requests. Please slow down.",
        });
        expect(mocks.authProtect).toHaveBeenCalledWith(request, { userId: "user_123" });
    });

    it("fails open on transient Arcjet service errors after logging the failure", async () => {
        mocks.publicProtect.mockRejectedValue(new Error("network unavailable"));
        const { protectPublicApiRequest } = await loadArcjetModule();

        await expect(protectPublicApiRequest(request as never)).resolves.toEqual({ allowed: true });
        expect(mocks.loggerError).toHaveBeenCalledWith(
            "[Arcjet] Public API protection failed open",
            expect.objectContaining({ error: expect.any(Error) }),
        );
    });

    it("fails closed in production when ARCJET_KEY is missing", async () => {
        delete process.env.ARCJET_KEY;
        process.env.NODE_ENV = "production";

        const { protectPublicApiRequest } = await loadArcjetModule();

        await expect(protectPublicApiRequest(request as never)).resolves.toEqual({
            allowed: false,
            status: 503,
            code: "SECURITY_CONFIG_MISSING",
            message: "Request protection is not configured.",
        });
        expect(mocks.publicProtect).not.toHaveBeenCalled();
        expect(mocks.loggerError).toHaveBeenCalledWith(
            "[Arcjet] ARCJET_KEY is missing or invalid",
            { productionRuntime: true },
        );
    });
});
