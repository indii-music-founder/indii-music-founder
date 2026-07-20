import * as admin from 'firebase-admin';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface McpContext {
    user: admin.auth.DecodedIdToken;
}

export type McpOperationStatus =
    | 'draft'
    | 'intent_recorded'
    | 'queued'
    | 'requires_approval'
    | 'submitted'
    | 'acknowledged'
    | 'succeeded'
    | 'failed';

export interface McpOperationResult<T = Record<string, unknown>> {
    schemaVersion: 'mcp-operation-result.v1';
    tool: string;
    operationId: string;
    status: McpOperationStatus;
    actorUid: string;
    resource: {
        type: string;
        id: string;
        ownerUid: string;
    };
    idempotencyKey?: string;
    approval: {
        required: boolean;
        state: 'not_required' | 'pending' | 'approved' | 'rejected' | 'stale';
    };
    evidence: Array<{
        type: string;
        reference: string;
        sha256?: string;
    }>;
    warnings: string[];
    data?: T;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
}

export type McpToolResponse = CallToolResult;

export interface IndiiMcpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: (args: Record<string, unknown>, context: McpContext) => Promise<McpToolResponse>;
}
