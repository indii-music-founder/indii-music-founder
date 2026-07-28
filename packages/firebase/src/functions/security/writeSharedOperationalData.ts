import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const CACHE_HASH_PATTERN = /^-?[0-9a-f]{1,16}$/;
const VERTEX_CACHE_RESOURCE_PATTERN = /^projects\/[a-z0-9-]{1,63}\/locations\/[a-z0-9-]{1,40}\/cachedContents\/[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_INSTRUMENT_IDS = new Set(["generate_image", "generate_video"]);
const MIN_CACHE_TTL_SECONDS = 300;
const MAX_CACHE_TTL_SECONDS = 86_400;

interface RegisterAiContextCacheRequest {
    hash: string;
    resourceName: string;
    ttlSeconds?: number;
}

interface RecordInstrumentUsageRequest {
    instrumentId: string;
    outcome: "success" | "failed";
    executionId: string;
}

function requireAuthenticatedUid(request: CallableRequest): string {
    if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated.",
        );
    }
    return request.auth.uid;
}

export function validateContextCacheRegistration(data: RegisterAiContextCacheRequest): {
    hash: string;
    resourceName: string;
    ttlSeconds: number;
} {
    const ttlSeconds = data?.ttlSeconds ?? 3_600;
    if (
        typeof data?.hash !== "string" ||
        !CACHE_HASH_PATTERN.test(data.hash) ||
        typeof data?.resourceName !== "string" ||
        !VERTEX_CACHE_RESOURCE_PATTERN.test(data.resourceName) ||
        !Number.isInteger(ttlSeconds) ||
        ttlSeconds < MIN_CACHE_TTL_SECONDS ||
        ttlSeconds > MAX_CACHE_TTL_SECONDS
    ) {
        throw new HttpsError(
            "invalid-argument",
            "Invalid context-cache registration.",
        );
    }

    return { hash: data.hash, resourceName: data.resourceName, ttlSeconds };
}

/**
 * Server-only writer for per-user Vertex cached-content references.
 *
 * The client can read only its own reference through Firestore rules, while
 * Admin SDK owns all writes. Prefixing the document ID with the authenticated
 * uid prevents two users with the same content hash from sharing or replacing
 * one another's Vertex resource reference.
 */
export const registerAiContextCache = onCall(
    { memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        const userId = requireAuthenticatedUid(request);
        const validated = validateContextCacheRegistration(
            (request.data ?? {}) as RegisterAiContextCacheRequest,
        );
        const now = Date.now();

        await admin.firestore()
            .collection("ai_context_cache")
            .doc(`${userId}_${validated.hash}`)
            .set({
                id: validated.resourceName,
                hash: validated.hash,
                userId,
                expireTime: now + validated.ttlSeconds * 1_000,
                lastUsed: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

        return { success: true };
    },
);

export function validateInstrumentUsage(data: RecordInstrumentUsageRequest): RecordInstrumentUsageRequest {
    if (
        typeof data?.instrumentId !== "string" ||
        !ALLOWED_INSTRUMENT_IDS.has(data.instrumentId) ||
        (data.outcome !== "success" && data.outcome !== "failed") ||
        typeof data.executionId !== "string" ||
        !/^[A-Za-z0-9_-]{8,80}$/.test(data.executionId)
    ) {
        throw new HttpsError(
            "invalid-argument",
            "Invalid instrument usage event.",
        );
    }
    return data;
}

/**
 * Server-only aggregate writer. The client reports one bounded outcome; it
 * cannot replace aggregate counters or inject arbitrary instrument IDs.
 */
export const recordInstrumentUsage = onCall(
    { memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        const userId = requireAuthenticatedUid(request);
        const { instrumentId, outcome, executionId } = validateInstrumentUsage(
            (request.data ?? {}) as RecordInstrumentUsageRequest,
        );
        const db = admin.firestore();
        const statsRef = db.collection("instrument_usage_stats").doc(instrumentId);
        const eventRef = db.collection("instrument_usage_events").doc(`${userId}_${executionId}`);
        const rateRef = db.collection("instrument_usage_rate_limits").doc(`${userId}_${instrumentId}`);
        const maxPerMinute = instrumentId === "generate_video" ? 2 : 10;
        const now = Date.now();

        const update: Record<string, unknown> = {
            totalExecutions: admin.firestore.FieldValue.increment(1),
            successfulExecutions: admin.firestore.FieldValue.increment(outcome === "success" ? 1 : 0),
            failedExecutions: admin.firestore.FieldValue.increment(outcome === "failed" ? 1 : 0),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (outcome === "success") {
            update.lastExecutionTime = admin.firestore.FieldValue.serverTimestamp();
        }

        const duplicate = await db.runTransaction(async (tx) => {
            const [eventSnapshot, rateSnapshot] = await Promise.all([
                tx.get(eventRef),
                tx.get(rateRef),
            ]);
            if (eventSnapshot.exists) return true;

            const priorRate = rateSnapshot.data() as { windowStartedAt?: number; count?: number } | undefined;
            const sameWindow =
                typeof priorRate?.windowStartedAt === "number" &&
                now - priorRate.windowStartedAt < 60_000;
            const count = sameWindow && typeof priorRate?.count === "number" ? priorRate.count : 0;
            if (count >= maxPerMinute) {
                throw new HttpsError(
                    "resource-exhausted",
                    "Instrument usage reporting rate exceeded.",
                );
            }

            tx.set(eventRef, {
                userId,
                instrumentId,
                outcome,
                executionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(rateRef, {
                userId,
                instrumentId,
                windowStartedAt: sameWindow ? priorRate!.windowStartedAt : now,
                count: count + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(statsRef, update, { merge: true });
            return false;
        });

        return { success: true, duplicate };
    },
);
