import { onRequest } from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import * as express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { McpToolRegistry } from './registry.js';
import { McpContext } from './types.js';
import * as toolModules from './tools/index.js';

const ALL_TOOLS = Object.values(toolModules);

const app = express.default();
// Cloud Functions/Cloud Run terminates TLS at the load balancer and forwards
// internally over plain HTTP — without this, req.protocol always reports
// 'http' even for a real HTTPS caller (X-Forwarded-Proto is set but ignored
// unless Express is told to trust the proxy).
app.set('trust proxy', true);
app.use(cors({ origin: true }));

interface McpSession {
    context: McpContext;
    transport: SSEServerTransport;
}

// Per-session state — a fresh Server + registry per SSE connection (never
// one shared Server across concurrent users; see ISSUE-1092 evidence: a
// single shared instance let a second user's connect() rebind the
// transport and misroute responses to the wrong user's stream).
const sessions = new Map<string, McpSession>();

async function verifyBearerToken(req: express.Request): Promise<admin.auth.DecodedIdToken> {
    const authHeader = req.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        throw new Error('Missing or malformed Authorization header.');
    }
    return admin.auth().verifyIdToken(match[1]!);
}

app.get('/sse', async (req, res) => {
    let decoded: admin.auth.DecodedIdToken;
    try {
        decoded = await verifyBearerToken(req);
    } catch (error) {
        console.warn('[MCP Server] SSE connection rejected: invalid or missing token.', error instanceof Error ? error.message : error);
        res.status(401).send('Unauthorized');
        return;
    }

    console.log(`[MCP Server] New SSE connection request for uid ${decoded.uid}`);

    // Build a fully-qualified absolute HTTPS URL — never a bare relative
    // path (the MCP SDK client resolves a leading-slash path against the
    // origin ROOT, silently dropping any prefix) and never derived from
    // req.protocol (reports 'http': Cloud Functions/Cloud Run terminates TLS
    // at the load balancer and forwards internally over plain HTTP).
    //
    // The cloudfunctions.net routing convention strips the function-name
    // path segment (/mcpEndpoint) before Express ever sees the request —
    // live test 2026-07-21 confirmed req.originalUrl is bare '/sse' even
    // when the client's actual external URL was .../mcpEndpoint/sse. That
    // segment has to be reconstructed for the client's next request to
    // route back to this same function; it's absent entirely when accessed
    // via the function's direct Cloud Run subdomain instead.
    const host = req.get('host') || '';
    const functionPathPrefix = host.endsWith('.cloudfunctions.net') ? '/mcpEndpoint' : '';
    const messageUrl = `https://${host}${functionPathPrefix}/message`;
    const transport = new SSEServerTransport(messageUrl, res);
    const sessionId = transport.sessionId;

    const server = new Server(
        {
            name: 'indii-remote-mcp-server',
            version: '0.2.0',
        },
        {
            capabilities: {
                tools: {},
            },
        },
    );

    const context: McpContext = { user: decoded };
    const registry = new McpToolRegistry(ALL_TOOLS);
    registry.register(server, context);

    sessions.set(sessionId, { context, transport });

    console.log(`[MCP Server] SSE connection established: ${sessionId} (uid ${decoded.uid})`);

    res.on('close', () => {
        console.log(`[MCP Server] SSE connection closed: ${sessionId}`);
        sessions.delete(sessionId);
    });

    await server.connect(transport);
});

app.post('/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const session = sessions.get(sessionId);

    if (!session) {
        console.warn(`[MCP Server] Message received for unknown session: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
    }

    // Defense in depth: the message's own bearer token must belong to the
    // SAME uid the session was established with. A sessionId is a UUID
    // carried in a query string — verifying it here stops a leaked/guessed
    // sessionId from injecting messages into another user's session.
    try {
        const decoded = await verifyBearerToken(req);
        if (decoded.uid !== session.context.user.uid) {
            console.warn(`[MCP Server] Message rejected: token uid ${decoded.uid} does not match session uid ${session.context.user.uid}.`);
            res.status(403).send('Forbidden');
            return;
        }
    } catch (error) {
        console.warn('[MCP Server] Message rejected: invalid or missing token.', error instanceof Error ? error.message : error);
        res.status(401).send('Unauthorized');
        return;
    }

    await session.transport.handlePostMessage(req, res);
});

// Gen2 (Cloud Run under the hood) — Gen1 killed every SSE connection at its
// ~60s execution ceiling regardless of timeoutSeconds, since Gen1 functions
// are fundamentally request/response and don't support a connection meant to
// stay open indefinitely. Verified live (2026-07-21): a Gen1 deploy of this
// exact code authenticated and established the session correctly, then was
// hard-killed at 62.5s with a 502 "Truncated response body" — proving Gen2
// migration, not the auth/registry wiring, was the remaining blocker.
//
// maxInstances: 1 is deliberate, not an oversight: sessions live in the
// in-process `sessions` Map above. Cloud Run does not guarantee session
// affinity across instances by default, so a POST /message routed to a
// different instance than the one holding its session would 404. Capping at
// one instance guarantees every request reaches the same in-memory Map.
// Concurrency is left at its Gen2 default so that instance can still serve
// many simultaneous SSE connections (Node's event loop, not multiple
// instances, is what's shared here). Trades horizontal scalability for
// correctness — the real long-term fix is moving session state to
// Firestore/Redis so multiple instances can share it.
export const mcpEndpoint = onRequest(
    {
        region: 'us-central1',
        timeoutSeconds: 3600,
        memory: '512MiB',
        maxInstances: 1,
    },
    app,
);
export const expressApp = app;
