/**
 * Shared Inngest client factory — extracted from index.ts so callers (MCP
 * tool handlers, Inngest step functions) can get a client without importing
 * the entire root index.ts module (which calls admin.initializeApp() and
 * pulls in every Cloud Function as an import-time side effect).
 */
import { Inngest } from 'inngest';

export const getInngestClient = (): Inngest => {
    // A bound Firebase secret is exposed as process.env.INNGEST_EVENT_KEY, so
    // this read is the whole lookup. Calling `inngestEventKey.value()` as a
    // fallback could only re-read the same env var, and on every function that
    // does not bind the secret it logged "No value found for secret parameter"
    // at each cold start (~260 functions, because orchestration/inngest.ts
    // builds a client at module load). Unbound callers keep an undefined key,
    // exactly as before.
    const eventKey = process.env.INNGEST_EVENT_KEY || undefined;
    return new Inngest({
        id: 'indii-music-functions',
        eventKey,
    });
};
