/**
 * Local MCP gateway stub for e2e specs.
 *
 * The renderer's MCP client uses the SDK's `SSEClientTransport`, which reads
 * every JSON-RPC response from a long-lived SSE stream. A Playwright
 * `route.fulfill` closes that stream immediately, so a route mock can never
 * answer a tool call (ISSUE-1691). This stub is a real SSE server built on the
 * same `SSEServerTransport` the production gateway uses
 * (`packages/firebase/src/mcp/index.ts`).
 *
 * In dev builds the client resolves the gateway to
 * `http://127.0.0.1:5001/<projectId>/us-central1/mcpEndpoint`
 * (`packages/renderer/src/services/agent/harness/mcpEndpoint.ts`), so the stub
 * listens there and serves any `.../mcpEndpoint/{sse,message}` path.
 *
 * Structural only: this stands in for the Cloud Function. It proves the
 * client/transport/agent wiring, not the deployed gateway or real tools.
 */
import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export const MCP_STUB_MARKER = 'MOCK_DATA_FROM_MCP_SERVER';

const TOOL_NAMES = ['generate_playlist_pitch'];
const GATEWAY_SUFFIX = '/mcpEndpoint';

export interface McpSseStub {
    /** Tool calls received, in order. */
    readonly calls: { name: string; args: unknown }[];
    stop(): Promise<void>;
}

function setCors(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, mcp-protocol-version');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

export async function startMcpSseStub(port = 5001, host = '127.0.0.1'): Promise<McpSseStub> {
    const transports = new Map<string, SSEServerTransport>();
    const calls: { name: string; args: unknown }[] = [];

    const httpServer = http.createServer(async (req, res) => {
        setCors(req, res);
        if (req.method === 'OPTIONS') {
            res.writeHead(204).end();
            return;
        }

        const url = new URL(req.url ?? '/', `http://${host}:${port}`);
        const prefix = url.pathname.replace(/\/(sse|message)$/, '');
        if (!prefix.endsWith(GATEWAY_SUFFIX)) {
            res.writeHead(404).end();
            return;
        }

        if (req.method === 'GET' && url.pathname.endsWith('/sse')) {
            const transport = new SSEServerTransport(`${prefix}/message`, res);
            transports.set(transport.sessionId, transport);
            res.on('close', () => transports.delete(transport.sessionId));

            const server = new Server({ name: 'indii-e2e-mcp-stub', version: '0.0.0' }, { capabilities: { tools: {} } });
            server.setRequestHandler(ListToolsRequestSchema, async () => ({
                tools: TOOL_NAMES.map(name => ({
                    name,
                    description: `e2e stub for ${name}`,
                    inputSchema: { type: 'object' as const, properties: {}, additionalProperties: true },
                })),
            }));
            server.setRequestHandler(CallToolRequestSchema, async request => {
                calls.push({ name: request.params.name, args: request.params.arguments });
                return {
                    content: [{ type: 'text' as const, text: `${MCP_STUB_MARKER}: ${request.params.name} executed successfully` }],
                };
            });
            await server.connect(transport);
            return;
        }

        if (req.method === 'POST' && url.pathname.endsWith('/message')) {
            const transport = transports.get(url.searchParams.get('sessionId') ?? '');
            if (!transport) {
                res.writeHead(404).end('Unknown MCP session');
                return;
            }
            await transport.handlePostMessage(req, res);
            return;
        }

        res.writeHead(405).end();
    });

    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => resolve());
    });

    return {
        calls,
        stop: () => new Promise<void>(resolve => {
            for (const transport of transports.values()) void transport.close();
            transports.clear();
            httpServer.closeAllConnections();
            httpServer.close(() => resolve());
        }),
    };
}
