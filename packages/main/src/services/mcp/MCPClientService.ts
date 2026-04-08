import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

export class MCPClientService {
    private client: Client | null = null;
    private transport: StdioClientTransport | null = null;

    /**
     * Initializes the connection to the local MCP server running over stdio
     */
    public async connect(): Promise<void> {
        if (this.client) {
            return;
        }

        // Assuming building via vite/tsc puts the app in dist or out, but we need
        // the path to packages/mcp-server-local/dist/index.js
        // If we are in packages/main/dist, it might be different. Let's rely on Node resolution or absolute paths if possible, but during dev test it's src/services/mcp.
        const serverPath = path.resolve(__dirname, '../../../../mcp-server-local/dist/index.js');

        this.transport = new StdioClientTransport({
            command: 'node',
            args: [serverPath],
            env: process.env as Record<string, string>,
        });

        this.client = new Client(
            {
                name: 'indiiOS-main-mcp-client',
                version: '0.1.0',
            },
            {
                capabilities: {},
            }
        );

        await this.client.connect(this.transport);
        console.log('✅ Connected to local MCP Server over Stdio');
    }

    /**
     * Disconnects the MCP connection and kills the child process
     */
    public async disconnect(): Promise<void> {
        if (this.transport) {
            await this.transport.close();
            this.transport = null;
        }
        this.client = null;
        console.log('🛑 Disconnected from local MCP Server');
    }

    /**
     * Executes a tool provided by the MCP server
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async callTool(toolName: string, args: Record<string, unknown>): Promise<any> {
        if (!this.client) {
            throw new Error('MCP Client is not connected');
        }

        try {
            const response = await this.client.callTool({
                name: toolName,
                arguments: args,
            });
            return response;
        } catch (error) {
            console.error(`MCP Tool Call Error (${toolName}):`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const mcpClientService = new MCPClientService();
