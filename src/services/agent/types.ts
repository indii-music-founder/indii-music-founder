
import { AgentMessage } from '@/core/store';
import { UserProfile, BrandKit } from '@/modules/workflow/types';

export type SchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface ToolParameterSchema {
    type: SchemaType;
    description?: string;
    enum?: string[];
    items?: ToolParameterSchema;
    properties?: Record<string, ToolParameterSchema>;
    required?: string[];
}

export interface ToolParameters {
    type: 'OBJECT' | 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
}

import { ZodType } from 'zod';

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: ToolParameters;
    schema?: ZodType;
}

export interface ToolDefinition {
    functionDeclarations: FunctionDeclaration[];
}

// ============================================================================
// Agent Identification
// ============================================================================


/**
 * All valid agent IDs that can be used with delegate_task.
 * This is the single source of truth for agent ID validation.
 *
 * IMPORTANT: Keep this in sync when adding new agents.
 * Used to prevent AI hallucination of non-existent agent IDs.
 */
export const VALID_AGENT_IDS = [
    'marketing',
    'legal',
    'finance',
    'producer',
    'music',
    'director',
    'screenwriter',
    'video',
    'social',
    'publicist',
    'road',
    'road-manager', // Alias for road
    'publishing',
    'licensing',
    'brand',
    'devops',
    'security',
    'merchandise',  // Merchandise creation & production
    'generalist'  // Agent Zero
] as const;

export type ValidAgentId = typeof VALID_AGENT_IDS[number];

/**
 * Comma-separated list of valid agent IDs for use in tool descriptions.
 * Prevents AI from hallucinating non-existent agent names.
 */
export const VALID_AGENT_IDS_LIST = VALID_AGENT_IDS.join(', ');

export type AgentCategory = 'manager' | 'department' | 'specialist';

// ============================================================================
// Agent Context Types
// ============================================================================

export interface ProjectHandle {
    id: string;
    name: string;
    type: string;
}

export interface DistributorInfo {
    name: string | null;
    isConfigured: boolean;
    coverArtSize: { width: number; height: number };
    audioFormat: string[];
    promptContext: string;
}

export interface AgentContext {
    userId?: string;
    orgId?: string;
    projectId?: string;
    projectHandle?: ProjectHandle;
    chatHistory?: AgentMessage[];
    chatHistoryString?: string;
    brandKit?: BrandKit;
    memoryContext?: string;
    relevantMemories?: string[];
    activeModule?: string;
    userProfile?: UserProfile;
    distributor?: DistributorInfo;
    traceId?: string;
    attachments?: { mimeType: string; base64: string }[];
    systemPrompt?: string;
}

export type ProactiveTriggerType = 'schedule' | 'event' | 'proactive_trigger';

export interface ProactiveTask {
    id: string;
    agentId: string;
    task: string;
    triggerType: ProactiveTriggerType;
    executeAt?: number; // timestamp
    eventPattern?: string; // e.g. 'TASK_COMPLETED' or regex
    status: 'pending' | 'executing' | 'completed' | 'failed';
    createdAt: number;
    lastError?: string;
    userId: string;
}

// Using types from @/modules/workflow/types via imports above

export interface KnowledgeItem {
    id: string;
    title: string;
    content: string;
    type: string;
}

// ============================================================================
// Tool Function Types
// ============================================================================

export type ToolFunctionArgs = Record<string, unknown>;

export interface ToolFunctionResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    /** Metadata for tracing and debugging (e.g. latency, model version used) */
    metadata?: Record<string, unknown>;
}

/**
 * Tool function type - accepts any args that extend ToolFunctionArgs
 * The runtime will validate args against the tool schema.
 * All tools MUST return a ToolFunctionResult for standardization.
 */
export type ToolFunction<TArgs extends ToolFunctionArgs = ToolFunctionArgs> = (
    args: TArgs,
    context?: AgentContext
) => Promise<ToolFunctionResult>;

/**
 * Generic tool function type for agent configs
 * Uses contravariance to accept more specific arg types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolFunction = (args: any, context?: AgentContext) => Promise<ToolFunctionResult>;

// ============================================================================
// Agent Configuration Types
// ============================================================================

export interface AgentConfig {
    // ValidAgentId provides strict typing while allowing legacy agents via the union
    id: ValidAgentId;
    name: string;
    description: string;
    color: string;
    category: AgentCategory;
    systemPrompt: string;
    tools: ToolDefinition[];
    functions?: Record<string, AnyToolFunction>;
}

// ============================================================================
// Agent Execution Types
// ============================================================================

export interface AgentExecutionEvent {
    type: 'token' | 'thought' | 'tool' | 'error' | 'complete';
    content: string;
    toolName?: string;
    toolArgs?: ToolFunctionArgs;
    toolResult?: ToolFunctionResult | string;
}

export interface AgentExecutionResult {
    text: string;
    toolCalls?: Array<{
        name: string;
        args: ToolFunctionArgs;
        result: ToolFunctionResult | string;
    }>;
    thoughts?: string[];
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export type AgentResponse = AgentExecutionResult;
