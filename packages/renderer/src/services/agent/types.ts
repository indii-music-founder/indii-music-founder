/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import type { WhiskState } from '@/core/store/slices/creative';
export type { WhiskState };

import type { AgentMessage } from '@/core/store/slices/agent';
export type { AgentMessage };
import { UserProfile, BrandKit } from '@/modules/workflow/types';
import { INDII_MESSAGES } from './constants';
import type { AgentIdentityCard } from './governance/AgentIdentity';

export type SchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface ToolParameterSchema {
    type: SchemaType;
    description?: string;
    enum?: string[];
    default?: string | number | boolean;
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

export type ToolRiskTier = 'read' | 'write' | 'destructive';
export type PermissionTier = 'builtin' | 'core' | 'plugin';

export interface ToolRiskMetadata {
    riskTier: ToolRiskTier;
    permissionTier: PermissionTier;
    requiresApproval: boolean;
    description: string;
}

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: ToolParameters;
    schema?: ZodType;
    /**
     * Risk classification for governance and permission gating.
     * - 'read': Safe, no side effects (e.g., list_projects, recall_memories)
     * - 'write': Creates or mutates data (e.g., create_project, save_memory)
     * - 'destructive': Irreversible or high-impact (e.g., rotate_credentials, deploy)
     * Defaults to 'write' at runtime if not specified.
     */
    riskTier?: ToolRiskTier;
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
    'director',
    'screenwriter',
    'video',
    'social',
    'publicist',
    'road',
    'creative',
    'publishing',
    'licensing',
    'brand',
    'devops',
    'security',
    'merchandise',  // Merchandise creation & production
    'distribution', // Industrial Direct-to-DSP Engine
    'music',        // Sonic Director - Audio Analysis & Metadata
    'curriculum',   // Music Education Specialist
    'keeper',       // Context Integrity Guardian
    'generalist'  // indii Conductor (Hub)
] as const;

export type ValidAgentId = typeof VALID_AGENT_IDS[number];

/**
 * Comma-separated list of valid agent IDs for use in tool descriptions.
 * Prevents AI from hallucinating non-existent agent names.
 */
export const VALID_AGENT_IDS_LIST = VALID_AGENT_IDS.join(', ');

export type AgentCategory = 'manager' | 'department' | 'specialist';

// ============================================================================
// Hub-and-Spoke Architecture (Phase 4)
// ============================================================================

/**
 * The hub agent in the hub-and-spoke architecture.
 * All specialist agents must delegate through the hub.
 */
export const HUB_AGENT_ID = 'generalist';

/**
 * Specialist agents (spokes) that can only delegate to the hub.
 * These agents represent domain expertise and should not delegate to each other directly.
 */
export const SPOKE_AGENT_IDS = VALID_AGENT_IDS.filter(id => id !== HUB_AGENT_ID);

/**
 * Checks if an agent is the hub (generalist / indii Conductor).
 */
export function isHubAgent(agentId: string): boolean {
    return agentId === HUB_AGENT_ID;
}

/**
 * Checks if an agent is a spoke (specialist).
 */
export function isSpokeAgent(agentId: string): boolean {
    return (SPOKE_AGENT_IDS as readonly string[]).includes(agentId);
}

/**
 * Validates hub-and-spoke architecture rules.
 * Returns null if valid, or an error message if invalid.
 *
 * Rules:
 * - Hub can delegate to any spoke
 * - Spokes can only delegate to hub
 * - Spokes CANNOT delegate to other spokes
 */
export function validateHubAndSpoke(sourceAgentId: string, targetAgentId: string): string | null {
    // Hub can delegate to anyone
    if (isHubAgent(sourceAgentId)) {
        return null;
    }

    // Spokes can only delegate to hub
    if (isSpokeAgent(sourceAgentId)) {
        if (isHubAgent(targetAgentId)) {
            return null; // Spoke -> Hub is allowed
        }
        return INDII_MESSAGES.hubSpokeViolation(sourceAgentId, targetAgentId);
    }

    // Unknown agent (shouldn't happen due to earlier validation)
    return `Unknown source agent: ${sourceAgentId}`;
}

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
    userAlignmentRules?: string[]; // Injected strategic alignment rules
    ragCorpus?: string;
    activeModule?: string;
    userProfile?: UserProfile;
    distributor?: DistributorInfo;
    traceId?: string;
    attachments?: { mimeType: string; base64: string }[];
    systemPrompt?: string;
    whiskState?: WhiskState;
    livingContext?: string;
    getMetadata?: (key: string) => any;
    setMetadata?: (key: string, value: any) => void;
    /** Shared memory context explicitly passed between agents during delegation */
    sharedContext?: string;
    /** When set by ProactiveService, carries the triggering proactive task metadata */
    proactiveTask?: ProactiveTask;
    /** The trigger type that caused this agent execution (schedule, event, etc.) */
    triggerType?: ProactiveTriggerType;
    /** Breaking circular dependency: Runner provided at runtime */
    runAgent?: AgentRunner;
    /**
     * Cryptographic identity card for the executing agent.
     * Injected by BaseAgent during execution for provenance tracking.
     * @see AgentIdentityCard
     */
    agentIdentity?: AgentIdentityCard;

    // ---- Phase 2: Agent Orchestration & Memory ----

    /**
     * When true, BaseAgent runs the ReflectionLoop after generating output.
     * The loop re-evaluates quality and may trigger additional iterations.
     * @default false
     */
    enableReflection?: boolean;

    /**
     * Prior turn context frames from ContextStackService.
     * Injected before agent execution to provide multi-turn reasoning state.
     */
    contextStack?: ContextFrame[];

    /**
     * Compressed summary of the full context stack.
     * Used in the system prompt to give agents awareness of prior turns
     * without consuming excessive token budget.
     */
    contextSummary?: string;
}

export type AgentRunner = (
    agentId: string,
    task: string,
    context?: AgentContext,
    traceId?: string,
    attachments?: { mimeType: string; base64: string }[]
) => Promise<{ text: string; thoughtSignature?: string }>;

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

// ============================================================================
// Memory & Knowledge Types
// ============================================================================

export interface UserMemory {
    id: string;
    content: string;
    type: 'fact' | 'preference' | 'rule' | 'summary';
    timestamp: any; // Firestore Timestamp
    metadata?: Record<string, any>;
    important?: boolean;
    consolidated?: boolean;
    sourceIds?: string[];
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
    data?: any;
    error?: string;
    message?: string;
    /** Metadata for tracing and debugging (e.g. latency, model version used) */
    metadata?: Record<string, unknown>;
}

import type { ToolExecutionContext } from './ToolExecutionContext';

export interface DelegateTaskArgs extends ToolFunctionArgs {
    targetAgentId: ValidAgentId;
    task: string;
}

export interface ExpertConsultation {
    targetAgentId: ValidAgentId;
    task: string;
}

export interface ConsultExpertsArgs extends ToolFunctionArgs {
    consultations: ExpertConsultation[];
}

/**
 * Tool function type - accepts any args that extend ToolFunctionArgs
 * The runtime will validate args against the tool schema.
 * All tools MUST return a ToolFunctionResult for standardization.
 *
 * Phase 3: Added ToolExecutionContext for isolated state management.
 */
export type ToolFunction<TArgs extends ToolFunctionArgs = ToolFunctionArgs> = (
    args: TArgs,
    context?: AgentContext,
    toolContext?: ToolExecutionContext
) => Promise<ToolFunctionResult>;

/**
 * Generic tool function type for agent configs
 * Uses contravariance to accept more specific arg types
 */

export type AnyToolFunction = (
    args: any,
    context?: AgentContext,
    toolContext?: ToolExecutionContext
) => Promise<ToolFunctionResult>;

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
    /** Explicit allowlist of tool names this agent may invoke at runtime.
     *  If omitted, defaults to the names declared in tools[0].functionDeclarations.
     *  An empty array [] means the agent has NO tool access at runtime.
     */
    authorizedTools?: string[];
    /** Optional fine-tuned model endpoint. When set and the feature flag
     *  VITE_USE_FINE_TUNED_AGENTS is enabled, BaseAgent will use this model
     *  instead of the default AI_MODELS.TEXT.AGENT. Format:
     *  "tunedModels/{tunedModelName}" or full Vertex endpoint URI.
     */
    modelId?: string;
    /**
     * Pre-minted cryptographic identity card. If not provided,
     * BaseAgent will mint one automatically during construction.
     */
    identityCard?: AgentIdentityCard;
}

export interface AgentResponse {
    text: string;
    data?: unknown;
    toolCalls?: Array<{
        name: string;
        args: ToolFunctionArgs;
        result: ToolFunctionResult | string;
    }>;
    thoughts?: string[];
    thoughtSignature?: string;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export type AgentProgressCallback = (event: {
    type: 'thought' | 'tool' | 'token' | 'usage' | 'tool_result' | 'instrument execution';
    content: string;
    toolName?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCost?: number;
    }
}) => void;

export interface SpecializedAgent {
    id: string;
    name: string;
    description: string;
    color: string;
    category: AgentCategory;
    execute(task: string, context?: AgentContext, onProgress?: AgentProgressCallback, signal?: AbortSignal, attachments?: { mimeType: string; base64: string }[]): Promise<AgentResponse>;
}

export interface AgentRegistryProvider {
    getAsync(id: string, retryCount?: number): Promise<SpecializedAgent | undefined>;
    getLoadError(id: string): { error: Error; timestamp: number; attempts: number } | undefined;
    getAll(): SpecializedAgent[];
}

// ============================================================================
// Workflow Execution State Machine (Priority 1: Agentic Harness Primitive #4)
// ============================================================================

/**
 * Lifecycle status for a workflow execution or individual step.
 * Transitions: planned → executing → step_complete | failed | cancelled
 * Terminal states: completed, failed, cancelled
 */
export type WorkflowExecutionStatus =
    | 'planned'
    | 'executing'
    | 'step_complete'
    | 'awaiting_approval'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'skipped';

export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: (state: WorkflowExecution) => boolean; // Evaluates if the edge should be traversed
    label?: string; // Human-readable label for the transition
    metadata?: Record<string, any>; // Arbitrary metadata for the transition
}

export interface WorkflowStep {
    id: string; // Unique identifier for the step within the workflow
    agentId: string;
    prompt: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    timeoutMs?: number; // Optional timeout for this specific step
    retryCount?: number; // How many times to retry on failure
}

/**
 * Persisted state for a single step within a workflow execution.
 */
export interface WorkflowStepExecution {
    stepId: string;
    agentId: string;
    prompt: string;
    status: WorkflowExecutionStatus;
    idempotencyKey: string;
    result?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
}

/**
 * Persisted state for an entire workflow run.
 * Stored in Firestore under `users/{userId}/workflowExecutions/{id}`.
 */
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    sessionId?: string;
    userId: string;
    status: WorkflowExecutionStatus;
    steps: Record<string, WorkflowStepExecution>;
    edges: WorkflowEdge[];
    currentStepIndex: number;
    createdAt: number;
    updatedAt: number;
}

// ============================================================================
// Phase 2: Agent Orchestration & Memory Types
// ============================================================================

/**
 * The 5 memory layers in the IndiiOS Persistent Memory hierarchy.
 * Each layer has different persistence, TTL, and authority semantics.
 */
export type MemoryLayer = 'scratchpad' | 'session' | 'vault' | 'captains_log' | 'rag_index';

/**
 * A single memory entry that can exist in any of the 5 layers.
 * This is the universal currency of the PersistentMemoryService facade.
 */
export interface MemoryEntry {
    /** Unique identifier within the layer */
    id: string;
    /** Which memory layer this entry belongs to */
    layer: MemoryLayer;
    /** Lookup key (e.g., "artist_name", "preferred_genre") */
    key: string;
    /** The stored value (type depends on the layer) */
    value: unknown;
    /** Provenance and lifecycle metadata */
    metadata: {
        createdAt: number;
        updatedAt: number;
        /** Which agent wrote this entry (null = user-written) */
        agentId?: string;
        /** Project scope (null = global) */
        projectId?: string;
        /** Time-to-live in milliseconds (only for scratchpad/session layers) */
        ttl?: number;
        /** Source of truth for conflict resolution */
        source?: 'user' | 'agent' | 'webhook' | 'import' | 'onboarding';
    };
}

/**
 * Assembled context window from all 5 memory layers.
 * Used by agents to receive structured memory before execution.
 */
export interface ContextWindow {
    /** In-memory task-scoped key-value pairs */
    scratchpad: Record<string, unknown>;
    /** Recent session memories (last 24h) */
    sessionMemories: MemoryEntry[];
    /** Authoritative facts from CORE Vault */
    vaultFacts: string[];
    /** Recent Captain's Log entries */
    recentLogs: string[];
    /** Semantically matched RAG results */
    ragResults: MemoryEntry[];
    /** Estimated token count of the full context window */
    totalTokenEstimate: number;
}

/**
 * A single frame in the multi-turn context stack.
 * Represents one conversational turn's state snapshot.
 */
export interface ContextFrame {
    /** Unique identifier for this turn */
    turnId: string;
    /** When this turn occurred */
    timestamp: number;
    /** The user's message for this turn */
    userMessage: string;
    /** The agent's response for this turn */
    agentResponse: string;
    /** Tool calls made during this turn */
    toolCalls: { name: string; args: unknown; result: unknown }[];
    /** Key decisions made this turn (for summarization) */
    decisions: string[];
    /** Memory keys written during this turn (for rollback tracking) */
    memoryWrites: string[];
}

/**
 * Result of a ReflectionLoop evaluation pass.
 * Determines whether the agent should re-iterate on its output.
 */
export interface ReflectionResult {
    /** Whether the agent should produce another iteration */
    shouldIterate: boolean;
    /** Quality score from 0-10 (threshold: 7) */
    score: number;
    /** Specific feedback for improvement */
    feedback: string;
    /** Which iteration this result is from (1-indexed) */
    iterationCount: number;
    /** Hard cap on iterations (default: 3) */
    maxIterations: number;
}

/**
 * Callbacks for token-by-token streaming from AgentStreamingService.
 */
export interface StreamCallbacks {
    /** Called for each text token received */
    onToken: (token: string) => void;
    /** Called when the agent invokes a tool mid-stream */
    onToolCall: (name: string, args: Record<string, unknown>) => void;
    /** Called when a tool execution completes */
    onToolResult: (name: string, result: unknown) => void;
    /** Called when streaming is fully complete */
    onComplete: (response: AgentResponse) => void;
    /** Called on any error during streaming */
    onError: (error: Error) => void;
}
// ============================================================================
// Phase 4: Graph-Based Orchestration (NEXT)
// ============================================================================

/**
 * A specialized node in an Agentic Graph.
 * Nodes represent individual agent executions or logic gates.
 */
export interface GraphNode {
    id: string;
    agentId: ValidAgentId;
    /** The task template for this node. Can use placeholders like {{input}}. */
    taskTemplate: string;
    /** Whether this node must wait for all parents or just any parent. */
    waitCondition: 'all' | 'any';
    /** Optional hardcoded context overrides for this node. */
    contextOverrides?: Partial<AgentContext>;
}

/**
 * A directed edge between graph nodes.
 * Edges represent data flow and execution order.
 */
export interface GraphEdge {
    sourceId: string;
    targetId: string;
    /** Optional condition to traverse this edge (e.g. tool output matches regex). */
    condition?: string;
    /** Maps source output to target input placeholders. */
    inputMapping?: Record<string, string>;
}

/**
 * A non-linear workflow represented as a Directed Acyclic Graph (DAG).
 * Maps to GEAP Pillar 3: Graph-Based Orchestration.
 */
export interface AgentGraph {
    id: string;
    name: string;
    description: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** The node where execution begins. */
    entryNodeId: string;
    /** Metadata for tracking versioning and ownership. */
    metadata: {
        version: string;
        author: string;
        createdAt: number;
    };
}

/**
 * The execution state of a running graph.
 */
export interface GraphExecutionState {
    graphId: string;
    executionId: string;
    /** Map of node ID to its current execution status and output. */
    nodeStates: Record<string, {
        status: WorkflowExecutionStatus;
        output?: string;
        error?: string;
        startedAt?: number;
        completedAt?: number;
    }>;
    /** Overall status of the graph execution. */
    status: WorkflowExecutionStatus;
}
