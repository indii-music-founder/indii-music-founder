import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { IndiiMcpTool } from './types.js';

export class McpToolRegistry {
    private tools: Map<string, IndiiMcpTool> = new Map();

    constructor(tools: IndiiMcpTool[]) {
        for (const tool of tools) {
            this.tools.set(tool.name, tool);
        }
    }

    register(server: Server) {
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: Array.from(this.tools.values()).map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                })),
            };
        });

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const tool = this.tools.get(request.params.name);
            if (!tool) {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }

            return await tool.handler(request.params.arguments);
        });
    }
}
