/**
 * Shared Inngest client factory — extracted from index.ts so callers (MCP
 * tool handlers, Inngest step functions) can get a client without importing
 * the entire root index.ts module (which calls admin.initializeApp() and
 * pulls in every Cloud Function as an import-time side effect).
 */
import { Inngest } from 'inngest';
import { inngestEventKey } from '../config/secrets.js';

export const getInngestClient = (): Inngest => {
    return new Inngest({
        id: 'indii-music-functions',
        eventKey: inngestEventKey.value(),
    });
};
