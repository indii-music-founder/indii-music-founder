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
        const now = Date.now();

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
        const execution = await service.get(executionId);
        if (!execution) throw new Error(`Execution ${executionId} not found`);

        const nodeState = execution.nodeStates[nodeId];
        if (!nodeState) throw new Error(`Node ${nodeId} not found in execution ${executionId}`);

        execution.nodeStates[nodeId] = {
            ...nodeState,
            ...updates,
        };

        // Update overall graph status if needed
        if (updates.status === 'executing') {
            execution.status = 'executing';
        } else if (updates.status === 'failed') {
            execution.status = 'failed';
        }

        await service.set(executionId, execution);
    }

    /**
     * Finalizes the graph status if all terminal nodes are reached or execution is complete.
     */
    async finalizeStatus(userId: string, executionId: string, status: WorkflowExecutionStatus): Promise<void> {
        const service = this.getService(userId);
        const execution = await service.get(executionId);
        if (!execution) throw new Error(`Execution ${executionId} not found`);

        execution.status = status;
        await service.set(executionId, execution);
        logger.info(`[GraphState] Execution ${executionId} finalized with status: ${status}`);
    }
}

export const agentGraphStateService = new AgentGraphStateServiceImpl();
