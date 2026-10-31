import { onRequest } from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import * as express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { arcjetKey } from '../config/secrets';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { requireVerifiedServerEntitlement } from '../functions/auth/entitlements';

import { McpToolRegistry } from './registry.js';
import { mcpMessageUrl } from './messageUrl.js';
import { McpContext } from './types.js';
import * as toolModules from './tools/index.js';

const ALL_TOOLS = Object.values(toolModules);
// Stateless across sessions (its internal tools Map is built once and never
// mutated; only .register(server, context) below is per-session) — built
// once here rather than re-constructed on every single SSE connection.
const registry = new McpToolRegistry(ALL_TOOLS);

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

export function isMcpCorsPreflight(method: string, path: string): boolean {
    return method === 'OPTIONS' && (path === '/sse' || path === '/message');
}

async function verifyBearerToken(req: express.Request): Promise<admin.auth.DecodedIdToken> {
    const authHeader = req.get('Authorization') || '';
    const match = authHeader.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
        throw new Error('Missing or malformed Authorization header.');
    }
    return admin.auth().verifyIdToken(match[1]!);
}

function admittedUser(res: express.Response): admin.auth.DecodedIdToken | undefined {
    return res.locals['mcpUser'] as admin.auth.DecodedIdToken | undefined;
}

app.get('/sse', async (req, res) => {
    const decoded = admittedUser(res);
    if (!decoded) {
        res.status(401).send('Unauthorized');
        return;
    }

    console.log(`[MCP Server] New SSE connection request for uid ${decoded.uid}`);

    // Build a fully-qualified external callback URL — never a bare relative
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
    let messageUrl: string;
    try {
        messageUrl = mcpMessageUrl(
            host, process.env.FUNCTIONS_EMULATOR === 'true', process.env.GCLOUD_PROJECT,
        );
    } catch {
        res.status(400).send('Invalid MCP gateway host.');
        return;
    }
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
    const decoded = admittedUser(res);
    if (!decoded) {
        res.status(401).send('Unauthorized');
        return;
    }
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
    if (decoded.uid !== session.context.user.uid) {
        console.warn(`[MCP Server] Message rejected: token uid ${decoded.uid} does not match session uid ${session.context.user.uid}.`);
        res.status(403).send('Forbidden');
        return;
    }

    // Firebase Functions v2's onRequest already consumes and JSON-parses the
    // body before this handler runs (exposing it as req.body), so the
    // request stream itself is drained by the time we get here. Passing
    // req.body as handlePostMessage's third argument tells the SDK to use
    // it directly instead of re-reading the (already-exhausted) raw stream
    // — without this it throws "stream is not readable" (live test,
    // 2026-07-21).
    await session.transport.handlePostMessage(req, res, req.body);
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
        secrets: [arcjetKey],
        region: 'us-central1',
        timeoutSeconds: 3600,
        memory: '512MiB',
        maxInstances: 1,
    },
    async (req, res) => {
        // Browser Authorization headers trigger an unauthenticated CORS
        // preflight. Let Express answer only the two gateway transport paths;
        // no SSE or tool operation is dispatched by OPTIONS.
        if (isMcpCorsPreflight(req.method, req.path)) {
            return app(req, res);
        }
        let decoded: admin.auth.DecodedIdToken;
        try {
            decoded = await verifyBearerToken(req as express.Request);
        } catch {
            res.status(401).send('Unauthorized');
            return;
        }
        if (decoded.firebase?.sign_in_provider === 'anonymous') {
            res.status(403).send('Verified account required');
            return;
        }
        let entitlement: Awaited<ReturnType<typeof requireVerifiedServerEntitlement>>;
        try {
            entitlement = await requireVerifiedServerEntitlement(decoded.uid);
        } catch (error) {
            const code = (error as { code?: string })?.code;
            const denied = code === 'failed-precondition' || code === 'permission-denied';
            res.status(code === 'auth/user-not-found' ? 401 : denied ? 403 : 503)
                .send(code === 'auth/user-not-found' ? 'Unauthorized'
                    : denied ? 'Verified account required' : 'Account admission unavailable');
            return;
        }
        const protection = await protectAuthenticatedApiRequest(req as never, {
            userId: decoded.uid,
            policy: policyClassForServerEntitlement({ tier: entitlement.tier, isAdmin: decoded.admin === true }),
            operationId: `mcp-endpoint:${crypto.randomUUID()}`,
        });
        if (!protection.allowed) {
            res.status(protection.status || 429).send(protection.message || 'Too Many Requests');
            return;
        }
        res.locals = res.locals || Object.create(null);
        res.locals['mcpUser'] = decoded;
        return app(req, res);
    },
);
export const expressApp = app;
