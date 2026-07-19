import * as functions from "firebase-functions/v1";
import * as express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpToolRegistry } from './registry.js';

import {
    draftDspMetadata,
    generatePlaylistPitch,
    scheduleCampaignWaterfall,
    fetchBrandKit,
    queueRemotionRender,
    auditAssetResolutions,
    registerSplitSheet,
    draftCwrRegistration,
    auditSampleClearance,
    calculateRecoupment,
    stageStripePayouts
} from './tools/index.js';

import * as admin from 'firebase-admin';

// Re-enable appCheck enforcement if needed in the future, but for now we rely on Bearer token (JWT)
// const mcpApiKey = defineSecret('MCP_API_KEY');

const app = express.default();
app.use(cors({ origin: true }));

// Validate Firebase Auth JWT instead of static API key
app.use(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized: Missing or invalid Authorization header');
        return;
    }

    const token = authHeader.split('Bearer ')[1].trim();
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        // Attach the verified caller for tool-level authorization. Real tool
        // implementations MUST scope data access to this uid, never to
        // model-supplied ids like artistId (see ISSUE-1086 / ISSUE-1083).
        (req as express.Request & { user?: admin.auth.DecodedIdToken }).user = decodedToken;
        next();
    } catch (error) {
        console.error('[MCP Server] Error verifying Firebase Auth token:', error);
        res.status(401).send('Unauthorized: Invalid Firebase Auth token');
        return;
    }
});

// We define the tool list once
const toolsList = [
    draftDspMetadata,
    generatePlaylistPitch,
    scheduleCampaignWaterfall,
    fetchBrandKit,
    queueRemotionRender,
    auditAssetResolutions,
    registerSplitSheet,
    draftCwrRegistration,
    auditSampleClearance,
    calculateRecoupment,
    stageStripePayouts
];

// Map to hold active SSE transports
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
    console.log(`[MCP Server] New SSE connection request`);

    // The user was attached by the auth middleware
    const user = (req as express.Request & { user?: admin.auth.DecodedIdToken }).user;
    if (!user) {
        res.status(401).send('Unauthorized: Missing user context');
        return;
    }

    const server = new Server(
        {
            name: 'indii-remote-mcp-server',
            version: '0.1.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    const registry = new McpToolRegistry(toolsList);
    registry.register(server, { user });

    // In production this endpoint URL should match what Cloud Run exposes.
    const messageUrl = `${req.baseUrl || ''}/message`;

    const transport = new SSEServerTransport(messageUrl, res);

    // The SDK generates its own UUID sessionId
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    console.log(`[MCP Server] SSE connection established: ${sessionId}`);

    // Cleanup on disconnect
    res.on('close', () => {
        console.log(`[MCP Server] SSE connection closed: ${sessionId}`);
        transports.delete(sessionId);
    });

    await server.connect(transport);
});

app.post('/message', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
        console.warn(`[MCP Server] Message received for unknown session: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
    }

    await transport.handlePostMessage(req, res);
});

export const mcpEndpoint = functions
    .runWith({ enforceAppCheck: false })
    .https.onRequest(app);
export const expressApp = app;
