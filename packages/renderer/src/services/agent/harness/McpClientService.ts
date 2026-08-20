// The MCP SDK (and its AJV schema-validation stack) is heavy (~200KB minified).
// It is only needed at runtime when a tool actually connects to the backend MCP
// server, so it is loaded lazily inside connect() instead of eagerly at startup.
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

const MCP_SERVER_URL = import.meta.env.VITE_MCP_ENDPOINT || 'http://127.0.0.1:5001/indii-music-founder/us-central1/mcpEndpoint';

class McpClientService {
    private client: Client | null = null;
    private transport: SSEClientTransport | null = null;
    private isConnecting = false;

    /**
     * Connects to the backend MCP server via SSE using the current Firebase Auth token.
     */
    async connect(): Promise<void> {
        if (this.client) return;
        if (this.isConnecting) {
            // Wait for existing connection attempt to finish
            return new Promise(resolve => {
                const interval = setInterval(() => {
                    if (!this.isConnecting) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
        }

        this.isConnecting = true;
        try {
            // Lazy-load the MCP SDK only when a connection is actually requested.
            const [{ Client }, { SSEClientTransport }] = await Promise.all([
                import('@modelcontextprotocol/sdk/client/index.js'),
                import('@modelcontextprotocol/sdk/client/sse.js'),
            ]);
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User must be authenticated to connect to MCP Server.');
            }

            // Inject a fresh Firebase ID token into EVERY request via the SDK's
            // custom fetch. requestInit headers only cover the POST /message leg —
            // the SSE GET handshake would arrive without Authorization and be 401'd
            // by the backend JWT middleware. Per-request minting also survives the
            // 1-hour ID-token expiry on long-lived sessions.
            const authedFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
                const idToken = await auth.currentUser?.getIdToken();
                if (!idToken) {
                    throw new Error('MCP request blocked: no authenticated user.');
                }
                const headers = new Headers(init?.headers);
                headers.set('Authorization', `Bearer ${idToken}`);
                return fetch(input, { ...init, headers });
            };

            // Create standard SSE transport pointing to our /sse endpoint
            this.transport = new SSEClientTransport(
                new URL(`${MCP_SERVER_URL}/sse`),
                { fetch: authedFetch }
            );

            this.client = new Client({
                name: 'indii-agent-harness',
                version: '1.0.0'
            }, {
                capabilities: {}
            });

            await this.client.connect(this.transport);
            logger.debug('[McpClientService] Connected to backend MCP Server.');

        } catch (error) {
            logger.error('[McpClientService] Failed to connect to MCP Server:', error);
            this.client = null;
            this.transport = null;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Lists available tools from the backend.
     */
    async listTools() {
        await this.connect();
        if (!this.client) throw new Error('MCP Client not connected');
        return this.client.listTools();
    }

    /**
     * Executes a tool on the backend MCP server.
     */
    async executeTool(name: string, args: Record<string, unknown>) {
        logger.debug(`[McpClientService] executeTool called for ${name}`);
        await this.connect();
        if (!this.client) {
            logger.error('[McpClientService] MCP Client not connected after connect()');
            throw new Error('MCP Client not connected');
        }

        logger.debug(`[McpClientService] Calling remote tool: ${name}`, args);
        try {
            const result = await this.client.callTool({
                name,
                arguments: args
            });
            logger.debug(`[McpClientService] Tool ${name} returned:`, result);
            return result;
        } catch (err) {
            logger.error(`[McpClientService] Tool ${name} failed:`, err);
            throw err;
        }
    }

    /**
     * Disconnects from the server.
     */
    async disconnect() {
        if (this.transport) {
            await this.transport.close();
            this.transport = null;
            this.client = null;
        }
    }
}

// Export as a singleton
export const mcpClientService = new McpClientService();
