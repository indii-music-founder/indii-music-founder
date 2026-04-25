import { FirestoreService } from '../../FirestoreService';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
    GraphExecutionState,
    AgentGraph,
    WorkflowExecutionStatus,
} from '../types';

/**
 * AgentGraphStateService — Persistent Graph Execution State Machine
 *
 * Pillar 3: Graph-Based Orchestration
 *
 * Tracks the execution state of Directed Acyclic Graph (DAG) workflows in Firestore.
 * This allows for parallel execution, interruption, and resumption of complex
 * multi-agent workflows.
 *
 * Stored under: `users/{userId}/graphExecutions/{id}`
 */
class AgentGraphStateServiceImpl {
    private getService(userId: string): FirestoreService<GraphExecutionState> {
        return new FirestoreService<GraphExecutionState>(`users/${userId}/graphExecutions`);
    }

    /**
     * Initializes a new graph execution state based on an AgentGraph definition.
     */
    async createExecution(
        userId: string,
        graph: AgentGraph
    ): Promise<GraphExecutionState> {
        const service = this.getService(userId);
        const id = uuidv4();

        const nodeStates: Record<string, { status: WorkflowExecutionStatus }> = {};
        for (const node of graph.nodes) {
            nodeStates[node.id] = {
                status: 'planned' as WorkflowExecutionStatus,
            };
        }

        const execution: GraphExecutionState = {
            graphId: graph.id,
            executionId: id,
            nodeStates: nodeStates as Record<string, { 
                status: WorkflowExecutionStatus; 
                output?: string; 
                error?: string; 
                startedAt?: number; 
                completedAt?: number 
            }>,
            status: 'planned',
        };

        // We use set here to ensure the record exists
        await service.set(id, execution);
        logger.info(`[GraphState] Created execution ${id} for graph '${graph.name}' (${graph.id})`);
        return execution;
    }

    /**
     * Retrieves the current state of a graph execution.
     */
    async getExecution(userId: string, executionId: string): Promise<GraphExecutionState | null> {
        const service = this.getService(userId);
        return await service.get(executionId) || null;
    }

    /**
     * Updates a node's execution status and records start/completion times.
     * Uses atomic updates to prevent race conditions during parallel execution.
     */
    async updateNodeStatus(
        userId: string,
        executionId: string,
        nodeId: string,
        updates: {
            status: WorkflowExecutionStatus;
            output?: string;
            error?: string;
            startedAt?: number;
            completedAt?: number;
        }
    ): Promise<void> {
        const service = this.getService(userId);
        
        // Prepare atomic update object using dot-notation for nested fields
        const fieldUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            fieldUpdates[`nodeStates.${nodeId}.${key}`] = value;
        }

        // Also update overall graph status if this node transition implies it
        if (updates.status === 'executing') {
            fieldUpdates.status = 'executing';
        } else if (updates.status === 'failed') {
            fieldUpdates.status = 'failed';
        }

        await service.update(executionId, fieldUpdates as Partial<GraphExecutionState>);
    }

    /**
     * Finalizes the graph status if all terminal nodes are reached or execution is complete.
     */
    async finalizeStatus(userId: string, executionId: string, status: WorkflowExecutionStatus): Promise<void> {
        const service = this.getService(userId);
        await service.update(executionId, { status } as Partial<GraphExecutionState>);
        logger.info(`[GraphState] Execution ${executionId} finalized with status: ${status}`);
    }

    /**
     * Updates top-level metadata for the execution.
     */
    async updateExecutionMetadata(userId: string, executionId: string, metadata: Record<string, any>): Promise<void> {
        const service = this.getService(userId);
        
        const fieldUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(metadata)) {
            fieldUpdates[`metadata.${key}`] = value;
        }

        await service.update(executionId, fieldUpdates as Partial<GraphExecutionState>);
    }

    /**
     * Subscribes to changes in a graph execution state.
     */
    subscribeToExecution(
        userId: string,
        executionId: string,
        callback: (state: GraphExecutionState) => void
    ): () => void {
        const service = this.getService(userId);
        return service.subscribeDoc(executionId, (data) => {
            if (data) callback(data);
        });
    }
}

export const agentGraphStateService = new AgentGraphStateServiceImpl();
