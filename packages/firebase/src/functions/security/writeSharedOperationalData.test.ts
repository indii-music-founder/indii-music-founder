import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const set = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn((id: string) => ({ id, set }));
    const collection = vi.fn((name: string) => ({ name, doc }));
    const txGet = vi.fn();
    const txSet = vi.fn();
    const runTransaction = vi.fn(async (handler: (tx: unknown) => Promise<unknown>) => handler({
        get: txGet,
        set: txSet,
    }));
    const firestore = Object.assign(vi.fn(() => ({ collection, runTransaction })), {
        FieldValue: {
            increment: vi.fn((value: number) => ({ increment: value })),
            serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
        },
    });
    return { set, doc, collection, txGet, txSet, runTransaction, firestore };
});

vi.mock("firebase-admin", () => ({ firestore: mocks.firestore }));

vi.mock("firebase-functions/v2/https", () => {
    class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    }
    return {
        HttpsError,
        // Gen2 onCall accepts (handler) or (options, handler). These exports
        // declare generation-preserving options, so unwrap whichever argument
        // is the handler.
        onCall: vi.fn((optsOrHandler: unknown, maybeHandler?: unknown) =>
            typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler),
    };
});

import {
    recordInstrumentUsage,
    registerAiContextCache,
    validateContextCacheRegistration,
    validateInstrumentUsage,
} from "./writeSharedOperationalData";

// Gen2 callables receive a single CallableRequest ({ data, auth, app, ... })
// rather than Gen1's (data, context) pair.
type Callable = (request: unknown) => Promise<unknown>;

describe("shared operational data server writers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.txGet.mockResolvedValue({ exists: false, data: () => undefined });
    });

    it("rejects malformed cache resources and unbounded TTL values", () => {
        expect(() => validateContextCacheRegistration({
            hash: "not/a/hash",
            resourceName: "attacker-controlled",
            ttlSeconds: 60,
        })).toThrow("Invalid context-cache registration");
    });

    it("writes a cache reference under the authenticated user's namespace", async () => {
        await (registerAiContextCache as unknown as Callable)({
            data: {
                hash: "-1a2b3c",
                resourceName: "projects/indii-music-founder/locations/us-central1/cachedContents/cache_123",
                ttlSeconds: 3_600,
            },
            auth: { uid: "user-123" },
        });

        expect(mocks.collection).toHaveBeenCalledWith("ai_context_cache");
        expect(mocks.doc).toHaveBeenCalledWith("user-123_-1a2b3c");
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({
            hash: "-1a2b3c",
            id: "projects/indii-music-founder/locations/us-central1/cachedContents/cache_123",
            userId: "user-123",
        }), { merge: true });
    });

    it("requires authentication before writing shared operational data", async () => {
        await expect((registerAiContextCache as unknown as Callable)({
            data: {
                hash: "abc123",
                resourceName: "projects/indii-music-founder/locations/us-central1/cachedContents/cache_123",
            },
        })).rejects.toMatchObject({ code: "unauthenticated" });
        expect(mocks.set).not.toHaveBeenCalled();
    });

    it("accepts only the two registered instruments and bounded outcomes", () => {
        expect(validateInstrumentUsage({
            instrumentId: "generate_image",
            outcome: "success",
            executionId: "execution_123",
        })).toEqual({ instrumentId: "generate_image", outcome: "success", executionId: "execution_123" });
        expect(() => validateInstrumentUsage({
            instrumentId: "attacker_metric",
            outcome: "success",
            executionId: "execution_123",
        })).toThrow("Invalid instrument usage event");
    });

    it("increments one server-owned aggregate outcome instead of accepting counters", async () => {
        await (recordInstrumentUsage as unknown as Callable)({
            data: {
                instrumentId: "generate_video",
                outcome: "failed",
                executionId: "execution_123",
            },
            auth: { uid: "user-123" },
        });

        expect(mocks.collection).toHaveBeenCalledWith("instrument_usage_stats");
        expect(mocks.doc).toHaveBeenCalledWith("generate_video");
        expect(mocks.txSet).toHaveBeenCalledWith(
            expect.objectContaining({ id: "generate_video" }),
            {
                totalExecutions: { increment: 1 },
                successfulExecutions: { increment: 0 },
                failedExecutions: { increment: 1 },
                updatedAt: "SERVER_TIMESTAMP",
            },
            { merge: true },
        );
    });

    it("deduplicates a replayed execution receipt", async () => {
        mocks.txGet
            .mockResolvedValueOnce({ exists: true, data: () => ({}) })
            .mockResolvedValueOnce({ exists: false, data: () => undefined });

        await expect((recordInstrumentUsage as unknown as Callable)({
            data: {
                instrumentId: "generate_image",
                outcome: "success",
                executionId: "execution_replay",
            },
            auth: { uid: "user-123" },
        })).resolves.toEqual({ success: true, duplicate: true });

        expect(mocks.txSet).not.toHaveBeenCalled();
    });

    it("rate-limits random execution IDs before they can inflate global stats", async () => {
        mocks.txGet
            .mockResolvedValueOnce({ exists: false, data: () => undefined })
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({ windowStartedAt: Date.now(), count: 2 }),
            });

        await expect((recordInstrumentUsage as unknown as Callable)({
            data: {
                instrumentId: "generate_video",
                outcome: "success",
                executionId: "execution_random",
            },
            auth: { uid: "user-123" },
        })).rejects.toMatchObject({ code: "resource-exhausted" });

        expect(mocks.txSet).not.toHaveBeenCalled();
    });
});
