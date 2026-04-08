import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import path from 'path';

export class MCPClientService {
    private localClient: Client | null = null;
    private localTransport: StdioClientTransport | null = null;

    private remoteClient: Client | null = null;
    private remoteTransport: SSEClientTransport | null = null;

    /**
     * Initializes the connection to the local MCP server running over stdio
     */
    public async connectLocal(): Promise<void> {
        if (this.localClient) {
            return;
        }

        const serverPath = path.resolve(__dirname, '../../../../mcp-server-local/dist/index.js');

        this.localTransport = new StdioClientTransport({
            command: 'node',
            args: [serverPath],
            env: process.env as Record<string, string>,
        });

        this.localClient = new Client(
            {
                name: 'indiiOS-main-mcp-client-local',
                version: '0.1.0',
            },
            {
                capabilities: {},
            }
        );

        await this.localClient.connect(this.localTransport);
        console.log('✅ Connected to local MCP Server over Stdio');
    }

    /**
     * Initializes the connection to the remote MCP server running over SSE
     */
    public async connectRemote(url: string): Promise<void> {
        if (this.remoteClient) {
            return;
        }

        this.remoteTransport = new SSEClientTransport(new URL(url));

        this.remoteClient = new Client(
            {
                name: 'indiiOS-main-mcp-client-remote',
                version: '0.1.0',
            },
            {
                capabilities: {},
            }
        );

        await this.remoteClient.connect(this.remoteTransport);
        console.log(`✅ Connected to remote MCP Server over SSE at ${url}`);
    }

    /**
     * Disconnects both MCP connections
     */
    public async disconnect(): Promise<void> {
        if (this.localTransport) {
            await this.localTransport.close();
            this.localTransport = null;
        }
        this.localClient = null;
        console.log('🛑 Disconnected from local MCP Server');

        if (this.remoteTransport) {
            await this.remoteTransport.close();
            this.remoteTransport = null;
        }
        this.remoteClient = null;
        console.log('🛑 Disconnected from remote MCP Server');
    }

    /**
     * Executes a tool provided by the MCP server
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async executeTool(toolName: string, args: Record<string, unknown>): Promise<any> {
        const remoteTools = ['format_dsp_metadata'];

        let targetClient = this.localClient;
        let clientType = 'local';

        if (remoteTools.includes(toolName)) {
            targetClient = this.remoteClient;
            clientType = 'remote';
        }

        if (!targetClient) {
            throw new Error(`MCP Client (${clientType}) is not connected for tool: ${toolName}`);
        }

        try {
            const response = await targetClient.callTool({
                name: toolName,
                arguments: args,
            });
            return response;
        } catch (error) {
            console.error(`MCP Tool Call Error (${toolName} via ${clientType}):`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const mcpClientService = new MCPClientService();
