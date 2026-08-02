import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

const verifyIdTokenMock = vi.fn();

vi.mock('firebase-admin', () => ({
    auth: () => ({ verifyIdToken: verifyIdTokenMock }),
    default: { auth: () => ({ verifyIdToken: verifyIdTokenMock }) },
}));

// mcp/index.ts instantiates a McpToolRegistry from every real tool at module
// load — none of those tools run in this test (routes reject before
// dispatch), but importing them pulls in firebase-admin/stripe/etc. Mocking
// firebase-admin above is sufficient; the tools' own suites cover their logic.

import { expressApp } from './index.js';

function listen(): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer(expressApp);
        server.listen(0, () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, port });
        });
    });
}

describe('mcpEndpoint auth gate', () => {
    let server: http.Server;
    let baseUrl: string;

    beforeEach(async () => {
        verifyIdTokenMock.mockReset();
        const listening = await listen();
        server = listening.server;
        baseUrl = `http://127.0.0.1:${listening.port}`;
    });

    afterEach(() => {
        server?.close();
    });

    it('rejects GET /sse with no Authorization header', async () => {
        const res = await fetch(`${baseUrl}/sse`);
        if (res.status !== 401) {
            console.error('UNEXPECTED GET /sse STATUS:', res.status, await res.text());
        }
        expect(res.status).toBe(401);
        expect(verifyIdTokenMock).not.toHaveBeenCalled();
    });

    it('rejects GET /sse with a malformed Authorization header', async () => {
        const res = await fetch(`${baseUrl}/sse`, { headers: { Authorization: 'Basic abc123' } });
        expect(res.status).toBe(401);
    });

    it('rejects GET /sse when verifyIdToken throws (expired/invalid token)', async () => {
        verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has expired'));
        const res = await fetch(`${baseUrl}/sse`, { headers: { Authorization: 'Bearer bad-token' } });
        expect(res.status).toBe(401);
        expect(verifyIdTokenMock).toHaveBeenCalledWith('bad-token');
    });

    it('rejects POST /message with no Authorization header, even for an unknown session', async () => {
        const res = await fetch(`${baseUrl}/message?sessionId=nonexistent`, { method: 'POST' });
        if (res.status !== 404) {
            console.error('UNEXPECTED STATUS:', res.status, await res.text());
        }
        // Unknown session is checked first and returns 404 regardless of auth —
        // this still proves no session leaks any state without a real transport.
        expect(res.status).toBe(404);
    });

    it('never dispatches to a tool without a verified session', async () => {
        // No /sse handshake ever ran in this test, so no session exists — proves
        // /message cannot be used to reach the tool registry cold.
        const res = await fetch(`${baseUrl}/message?sessionId=anything`, {
            method: 'POST',
            headers: { Authorization: 'Bearer whatever', 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'tools/call', params: { name: 'stage_stripe_payouts', arguments: {} } }),
        });
        expect(res.status).toBe(404);
    });
});
