import * as functions from "firebase-functions/v1";
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

    // In production this endpoint URL should match what Cloud Functions exposes.
    const messageUrl = `${req.baseUrl || ''}/message`;
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

export const mcpEndpoint = functions
    .runWith({ enforceAppCheck: false })
    .https.onRequest(app);
export const expressApp = app;
