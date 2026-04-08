import { onRequest } from 'firebase-functions/v2/https';
import * as express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

const app = express.default();

const server = new Server(
    {
        name: 'indiios-remote-mcp-server',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Map to hold active SSE transports
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
    // Generate a unique session ID
    const sessionId = Math.random().toString(36).substring(2, 15);

    console.log(`[MCP Server] New SSE connection established: ${sessionId}`);

    // In production this endpoint URL should match what Cloud Run exposes. But we just need a relative path or absolute path
    // The firebase emulator usually mounts on /<project>/<region>/mcpEndpoint
    // We can just use a relative URL if clients support it, or an absolute path based on req.baseUrl
    const messageUrl = `${req.baseUrl || ''}/message?sessionId=${sessionId}`;

    const transport = new SSEServerTransport(messageUrl, res);
    transports.set(sessionId, transport);

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'format_dsp_metadata',
                description: 'Format digital service provider metadata based on strict release requirements.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        releaseTitle: { type: 'string', description: 'The title of the release' },
                        artists: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of primary artists',
                        },
                        genre: { type: 'string' },
                    },
                    required: ['releaseTitle', 'artists', 'genre'],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'format_dsp_metadata') {
        const { releaseTitle, artists, genre } = request.params.arguments as any;

        // Mocked remote operation that would actually hit Firestore/BigQuery
        const formattedMetadata = {
            upc: `US-INDIIOS-${Math.floor(Math.random() * 100000)}`,
            dspTitle: `${releaseTitle} - Single`,
            primaryArtistString: artists.join(' & '),
            genreCategory: genre.toUpperCase(),
            formattedAt: new Date().toISOString(),
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(formattedMetadata, null, 2),
                },
            ],
        };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

export const mcpEndpoint = onRequest({ cors: true }, app);
