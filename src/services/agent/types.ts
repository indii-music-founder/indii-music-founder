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

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: ToolParameters;
}

export interface ToolDefinition {
    functionDeclarations: FunctionDeclaration[];
}

// ============================================================================
// Agent Identification
// ============================================================================

export const VALID_AGENT_IDS = [
    'legal',
    'marketing',
    'brand',
    'road-manager',
    'music',
    // Legacy support for existing agents
    'finance',
    'producer',
    'director',
    'screenwriter',
    'video',
    'social',
    'publicist',
    'publishing',
    'licensing',
    'devops',
    'security',
    'generalist'
] as const;

export type ValidAgentId = typeof VALID_AGENT_IDS[number];

export const VALID_AGENT_IDS_LIST = VALID_AGENT_IDS.join(', ');

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
    data?: unknown;
    error?: string;
    message?: string;
}

/**
 * Tool function type - accepts any args that extend ToolFunctionArgs
 * The runtime will validate args against the tool schema
 */
export type ToolFunction<TArgs extends ToolFunctionArgs = ToolFunctionArgs> = (
    args: TArgs,
    context?: AgentContext
) => Promise<ToolFunctionResult | string>;

/**
 * Generic tool function type for agent configs
 * Uses contravariance to accept more specific arg types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolFunction = (args: any, context?: AgentContext) => Promise<ToolFunctionResult | string>;

// ============================================================================
// Agent Configuration Types
// ============================================================================

export type AgentCategory = 'manager' | 'department' | 'specialist';

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
}
