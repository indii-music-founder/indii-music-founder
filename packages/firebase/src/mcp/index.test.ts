import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdTokenMock = vi.fn();

vi.mock('firebase-admin', () => ({
    auth: () => ({ verifyIdToken: verifyIdTokenMock }),
    default: { auth: () => ({ verifyIdToken: verifyIdTokenMock }) },
}));

// mcp/index.ts instantiates a McpToolRegistry from every real tool at module
// load — none of those tools run in this test (routes reject before
// dispatch), but importing them pulls in firebase-admin/stripe/etc. Mocking
// firebase-admin above is sufficient; the tools' own suites cover their logic.

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { expressApp } from './index.js';

function requestApp(options: { method?: string; path: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; text: string; headers: Record<string, string> }> {
    return new Promise((resolve) => {
        const req = new Readable() as any;
        req._read = () => {};
        req.method = options.method || 'GET';
        req.url = options.path;
        req.headers = {};
        if (options.headers) {
            for (const [k, v] of Object.entries(options.headers)) {
                req.headers[k.toLowerCase()] = v;
            }
        }

        const resHeaders: Record<string, string> = {};
        const resChunks: Buffer[] = [];
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        res.setHeader = (k: string, v: string) => { resHeaders[k.toLowerCase()] = String(v); };
        res.getHeader = (k: string) => resHeaders[k.toLowerCase()];
        res.writeHead = (code: number, headers?: any) => {
            res.statusCode = code;
            if (headers) Object.assign(resHeaders, headers);
            return res;
        };
        res.write = (chunk: any) => {
            if (chunk) resChunks.push(Buffer.from(chunk));
            return true;
        };
        res.end = (chunk?: any) => {
            if (chunk) resChunks.push(Buffer.from(chunk));
            resolve({
                status: res.statusCode,
                headers: resHeaders,
                text: Buffer.concat(resChunks).toString('utf8'),
            });
            return res;
        };

        (expressApp as any)(req, res);

        if (options.body) {
            req.push(Buffer.from(options.body));
        }
        req.push(null);
    });
}

describe('mcpEndpoint auth gate', () => {
    beforeEach(() => {
        verifyIdTokenMock.mockReset();
    });

    it('rejects GET /sse with no Authorization header', async () => {
        const res = await requestApp({ path: '/sse' });
        expect(res.status).toBe(401);
        expect(verifyIdTokenMock).not.toHaveBeenCalled();
    });

    it('rejects GET /sse with a malformed Authorization header', async () => {
        const res = await requestApp({ path: '/sse', headers: { Authorization: 'Basic abc123' } });
        expect(res.status).toBe(401);
    });

    it('rejects GET /sse when verifyIdToken throws (expired/invalid token)', async () => {
        verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has expired'));
        const res = await requestApp({ path: '/sse', headers: { Authorization: 'Bearer bad-token' } });
        expect(res.status).toBe(401);
        expect(verifyIdTokenMock).toHaveBeenCalledWith('bad-token');
    });

    it('rejects POST /message with no Authorization header, even for an unknown session', async () => {
        const res = await requestApp({ method: 'POST', path: '/message?sessionId=nonexistent' });
        expect(res.status).toBe(404);
    });

    it('never dispatches to a tool without a verified session', async () => {
        const res = await requestApp({
            method: 'POST',
            path: '/message?sessionId=anything',
            headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'tools/call', params: { name: 'stage_stripe_payouts', arguments: {} } }),
        });
        expect(res.status).toBe(404);
    });
});
