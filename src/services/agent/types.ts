// ============================================================================
// Tool Parameter Schema Types
// ============================================================================

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
// Agent Context Types
// ============================================================================

export interface AgentContext {
    userId?: string;
    orgId?: string;
    projectId?: string;
    chatHistory?: ChatMessage[];
    brandKit?: BrandKit;
    memoryContext?: string;
    activeModule?: string;
    userProfile?: UserProfile;
}

export interface ChatMessage {
    role: 'user' | 'model' | 'system';
    content: string;
    timestamp?: number;
}

export interface BrandKit {
    colors: string[];
    fonts: string;
    brandDescription: string;
    negativePrompt: string;
    socials: Record<string, string>;
    brandAssets: string[];
    referenceImages: string[];
    releaseDetails: ReleaseDetails;
}

export interface ReleaseDetails {
    title: string;
    type: string;
    artists: string;
    genre: string;
    mood: string;
    themes: string;
    lyrics: string;
}

export interface UserProfile {
    id: string;
    bio?: string;
    preferences?: string;
    brandKit?: BrandKit;
    analyzedTrackIds?: string[];
    knowledgeBase?: KnowledgeItem[];
    savedWorkflows?: string[];
}

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
    id: string;
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
