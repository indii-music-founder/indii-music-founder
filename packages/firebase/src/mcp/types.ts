import * as admin from 'firebase-admin';

export interface McpContext {
    user: admin.auth.DecodedIdToken;
}

export interface IndiiMcpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: (args: Record<string, unknown>, context: McpContext) => Promise<{
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
    }>;
}
