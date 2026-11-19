/**
 * Generation admission limits shared by the server and the studio client.
 *
 * The server enforces GENERATION_RATE_LIMIT per user per endpoint over a
 * sliding window (packages/firebase/src/lib/rateLimit.ts, RATE_LIMITS.generation).
 * The studio paces its own model calls from these same numbers
 * (FirebaseIntelligenceService) so it never trips the server limit.
 */
export const GENERATION_RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 } as const;

/** Most Boardroom agents the server admits into a single dispatch plan. */
export const BOARDROOM_MAX_EXECUTED_AGENTS = 9;
