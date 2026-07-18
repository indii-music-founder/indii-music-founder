import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { auth } from '@/services/firebase';

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
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User must be authenticated to connect to MCP Server.');
            }

            const idToken = await user.getIdToken();

            // Create standard SSE transport pointing to our /sse endpoint
            this.transport = new SSEClientTransport(
                new URL(`${MCP_SERVER_URL}/sse`),
                {
                    requestInit: {
                        headers: {
                            'Authorization': `Bearer ${idToken}`
                        }
                    }
                }
            );

            this.client = new Client({
                name: 'indii-agent-harness',
                version: '1.0.0'
            }, {
                capabilities: {}
            });

            await this.client.connect(this.transport);
            console.log('[McpClientService] Connected to backend MCP Server.');

        } catch (error) {
            console.error('[McpClientService] Failed to connect to MCP Server:', error);
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
        await this.connect();
        if (!this.client) throw new Error('MCP Client not connected');
        
        console.log(`[McpClientService] Calling remote tool: ${name}`, args);
        return this.client.callTool({
            name,
            arguments: args
        });
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
