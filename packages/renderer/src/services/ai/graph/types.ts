import { ModuleId } from '@/core/constants';

/**
 * Node types for the AgentGraph
 */
export type AgentNodeType = 'agent' | 'human' | 'system' | 'router';

/**
 * Status of a node in the graph
 */
export type AgentNodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting';

/**
 * Definition of a node in the AgentGraph
 */
export interface AgentNode {
    id: string;
    type: AgentNodeType;
    moduleId?: ModuleId;
    label: string;
    status: AgentNodeStatus;
    data?: Record<string, any>;
    position?: { x: number; y: number };
}

/**
 * Definition of an edge in the AgentGraph
 */
export interface AgentEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    animated?: boolean;
}

/**
 * The full AgentGraph structure
 */
export interface AgentGraph {
    nodes: AgentNode[];
    edges: AgentEdge[];
    metadata?: Record<string, any>;
}

/**
 * Execution context for the AgentGraph
 */
export interface AgentGraphContext {
    graphId: string;
    currentNodes: string[]; // Active node IDs
    history: string[];      // Path taken
    payload: Record<string, any>; // Shared data between nodes
}
