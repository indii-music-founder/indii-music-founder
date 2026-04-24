import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { 
    AgentGraph, 
    GraphNode, 
    GraphExecutionState, 
    AgentContext,
} from '../types';
import { agentGraphStateService } from './AgentGraphStateService';
import { agentService } from '../AgentService';
import { AgentEventBus } from '../governance/AgentEventBus';
import { memoryBankService } from '../memory/MemoryBankService';

/**
 * AgentGraphService — Directed Acyclic Graph (DAG) Runner
 *
 * Pillar 3: Graph-Based Orchestration
 *
 * This service manages the execution of complex, multi-agent networks where 
 * workflows are defined as graphs. It handles parallel execution, 
 * data mapping between nodes, and conditional branching.
 */
export class AgentGraphService {

    /**
     * Executes an entire AgentGraph from scratch.
     */
    async executeGraph(graph: AgentGraph, context: AgentContext, initialInput?: string): Promise<string> {
        const userId = context.userId;
        if (!userId) throw new Error('userId is required for graph execution');

        const traceId = context.traceId || uuidv4();
        logger.info(`[AgentGraph] Starting graph execution: ${graph.name} (${graph.id}), trace: ${traceId}`);

        // Create the initial execution state in persistence
        const state = await agentGraphStateService.createExecution(userId, graph);
        
        AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_STARTED', graph.id, state.executionId, `Name: ${graph.name}`);

        try {
            const result = await this.runGraphLoop(userId, graph, state.executionId, context, traceId, initialInput);
            AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_COMPLETED', graph.id, state.executionId);
            return result;
        } catch (error: any) {
            AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_FAILED', graph.id, state.executionId, error.message);
            throw error;
        }
    }

    /**
     * Resumes a previously interrupted graph execution.
     * Pillar 3: Persistence & Scalability
     * 
     * @param executionId The ID of the execution to resume.
     * @param context The context for execution.
     * @param graph Optional graph definition. If not provided, it must be retrievable from state or registry.
     */
    async resumeGraph(executionId: string, context: AgentContext, graph?: AgentGraph): Promise<string> {
        const userId = context.userId;
        if (!userId) throw new Error('userId is required for graph resumption');

        const state = await agentGraphStateService.getExecution(userId, executionId);
        if (!state) throw new Error(`Execution ${executionId} not found`);

        logger.info(`[AgentGraph] Resuming graph execution: ${executionId}, state: ${state.status}`);

        // If graph is not provided, we should ideally fetch it from a registry using state.graphId
        // For now, we require it or throw.
        const graphToUse = graph || (context as any).graph; 
        if (!graphToUse) throw new Error(`Graph definition required to resume execution ${executionId}`);

        return await this.runGraphLoop(userId, graphToUse, executionId, context, context.traceId || uuidv4());
    }

    /**
     * The main execution loop for the graph.
     * Continues as long as there are nodes ready to be executed.
     */
    private async runGraphLoop(
        userId: string,
        graph: AgentGraph,
        executionId: string,
        context: AgentContext,
        traceId: string,
        initialInput?: string
    ): Promise<string> {
        let running = true;
        let lastOutput = '';
        let iteration = 0;
        const MAX_ITERATIONS = 1000; // Safety break

        while (running) {
            iteration++;
            if (iteration > MAX_ITERATIONS) {
                logger.error(`[AgentGraph] Execution ${executionId} exceeded MAX_ITERATIONS (${MAX_ITERATIONS}). Potential cycle detected.`);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                throw new Error('Maximum graph iterations exceeded');
            }

            const state = await agentGraphStateService.getExecution(userId, executionId);
            if (!state) throw new Error(`Execution ${executionId} lost during run`);

            if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
                running = false;
                break;
            }

            // 1. Identify ready nodes and handle conditional skipping
            const readyNodes: GraphNode[] = [];
            const nodesToSkip: string[] = [];
            
            for (const node of graph.nodes) {
                const nodeState = state.nodeStates[node.id];
                // Only consider nodes that haven't been processed yet
                if (!nodeState || (nodeState.status !== 'planned' && nodeState.status !== 'failed')) continue;

                // Entry node is always ready if it's planned
                if (node.id === graph.entryNodeId) {
                    readyNodes.push(node);
                    continue;
                }

                // Check parents and conditions
                const incomingEdges = graph.edges.filter(e => e.targetId === node.id);
                if (incomingEdges.length === 0) {
                    logger.warn(`[AgentGraph] Node ${node.id} is unreachable (no incoming edges and not entry node).`);
                    continue; 
                }

                const parentStates = incomingEdges.map(edge => ({
                    edge,
                    sourceState: state.nodeStates[edge.sourceId]
                }));

                const allParentsProcessed = parentStates.every(p => 
                    p.sourceState && (p.sourceState.status === 'step_complete' || p.sourceState.status === 'skipped' || p.sourceState.status === 'failed')
                );

                if (!allParentsProcessed) continue;

                // Evaluate wait condition and edge logic
                const validEdges = parentStates.filter(p => {
                    if (!p.sourceState || p.sourceState.status !== 'step_complete') return false;
                    return this.evaluateCondition(p.edge.condition, p.sourceState.output || '');
                });

                if (node.waitCondition === 'all') {
                    // All incoming paths that lead here must have succeeded AND their conditions must match
                    if (validEdges.length === incomingEdges.length) {
                        readyNodes.push(node);
                    } else {
                        logger.info(`[AgentGraph] Skipping node ${node.id}: 'all' wait condition not met.`);
                        nodesToSkip.push(node.id);
                    }
                } else if (node.waitCondition === 'any') {
                    // At least one incoming path must be valid
                    if (validEdges.length > 0) {
                        readyNodes.push(node);
                    } else {
                        logger.info(`[AgentGraph] Skipping node ${node.id}: 'any' wait condition not met.`);
                        nodesToSkip.push(node.id);
                    }
                }
            }

            // 2. Handle Skips
            for (const nodeId of nodesToSkip) {
                await agentGraphStateService.updateNodeStatus(userId, executionId, nodeId, {
                    status: 'skipped',
                    completedAt: Date.now()
                });
            }

            if (readyNodes.length === 0) {
                const hasPlanned = graph.nodes.some(n => state.nodeStates[n.id]?.status === 'planned');
                const hasExecuting = graph.nodes.some(n => state.nodeStates[n.id]?.status === 'executing');

                if (!hasPlanned && !hasExecuting) {
                    logger.info(`[AgentGraph] Execution ${executionId} complete (no more nodes to process).`);
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'completed');
                    running = false;
                } else if (!hasExecuting) {
                    logger.warn(`[AgentGraph] Graph execution ${executionId} stuck: unreachable planned nodes remaining.`);
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'completed');
                    running = false;
                } else {
                    // Wait for background tasks to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                continue;
            }

            // 3. Prepare tasks for ready nodes with Memory Bank Integration
            logger.info(`[AgentGraph] Iteration ${iteration}: Starting ${readyNodes.length} nodes in parallel: ${readyNodes.map(n => n.id).join(', ')}`);
            
            const tasks = await Promise.all(readyNodes.map(async (node) => {
                const prompt = this.resolveNodePrompt(node, graph, state, initialInput);
                
                // GEAP Pillar 2: SCALE - Pull relevant memories before execution
                let memoryContext = '';
                try {
                    const memories = await memoryBankService.searchMemories(userId, prompt, 5);
                    memoryContext = memories.map(m => m.memory).join('\n---\n');
                } catch (memErr) {
                    logger.warn(`[AgentGraph] Memory retrieval failed for node ${node.id}, continuing without it.`, memErr);
                }

                return {
                    nodeId: node.id,
                    agentId: node.agentId,
                    prompt,
                    context: { 
                        ...context, 
                        ...node.contextOverrides, 
                        memoryContext,
                        traceId: `${traceId}/${node.id}` 
                    },
                };
            }));

            // 4. Mark nodes as executing
            for (const node of readyNodes) {
                await agentGraphStateService.updateNodeStatus(userId, executionId, node.id, {
                    status: 'executing',
                    startedAt: Date.now()
                });
                AgentEventBus.emitNodeEvent('GRAPH_NODE_STARTED', graph.id, node.id, executionId);
            }

            // 5. Parallel execution
            try {
                const results = await Promise.all(tasks.map(async (task) => {
                    try {
                        const response = await agentService.delegateTask(task.agentId, task.prompt, task.context);
                        
                        // GEAP Pillar 2: SCALE - Commit output to Memory Bank
                        try {
                            await memoryBankService.addMemory(userId, `[Graph Node: ${task.nodeId}] Result: ${response.slice(0, 500)}`);
                        } catch (memErr) {
                            logger.warn(`[AgentGraph] Memory storage failed for node ${task.nodeId}`, memErr);
                        }
                        
                        return { nodeId: task.nodeId, success: true, output: response };
                    } catch (err: unknown) {
                        const error = err instanceof Error ? err : new Error(String(err));
                        logger.error(`[AgentGraph] Node ${task.nodeId} failed:`, error.message);
                        return { nodeId: task.nodeId, success: false, error: error.message };
                    }
                }));

                // 6. Update states and resolve next steps
                for (const res of results) {
                    if (res.success) {
                        await agentGraphStateService.updateNodeStatus(userId, executionId, res.nodeId, {
                            status: 'step_complete',
                            output: res.output,
                            completedAt: Date.now()
                        });
                        AgentEventBus.emitNodeEvent('GRAPH_NODE_COMPLETED', graph.id, res.nodeId, executionId);
                        lastOutput = res.output || ''; 
                    } else {
                        await agentGraphStateService.updateNodeStatus(userId, executionId, res.nodeId, {
                            status: 'failed',
                            error: res.error,
                            completedAt: Date.now()
                        });
                        AgentEventBus.emitNodeEvent('GRAPH_NODE_FAILED', graph.id, res.nodeId, executionId, res.error);
                        
                        // Terminal failure: stop graph if node fails (strict reliability)
                        logger.error(`[AgentGraph] Failing graph ${executionId} due to node ${res.nodeId} failure.`);
                        await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                        throw new Error(`Node ${res.nodeId} failed: ${res.error || 'Unknown error'}`);
                    }
                }
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[AgentGraph] Critical loop failure in ${executionId}:`, error);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                throw error;
            }
        }

        return `Graph execution finished. Final output snippet: ${lastOutput.slice(0, 200)}...`;
    }

    /**
     * Evaluates a condition against an output string.
     * Supports Regex or simple inclusion.
     */
    private evaluateCondition(condition: string | undefined, output: string): boolean {
        if (!condition) return true;
        
        try {
            const regex = new RegExp(condition, 'i');
            return regex.test(output);
        } catch (e) {
            return output.includes(condition);
        }
    }


    /**
     * Resolves placeholders in the task template using parent outputs and initial input.
     */
    private resolveNodePrompt(node: GraphNode, graph: AgentGraph, state: GraphExecutionState, initialInput?: string): string {
        let prompt = node.taskTemplate;

        // Replace global input
        if (initialInput) {
            prompt = prompt.replace(/\{\{input\}\}/g, initialInput);
        }

        // Find parent edges to map outputs
        const parentEdges = graph.edges.filter(e => e.targetId === node.id);
        for (const edge of parentEdges) {
            const parentOutput = state.nodeStates[edge.sourceId]?.output || '';
            
            // Apply input mappings if defined
            if (edge.inputMapping) {
                for (const [sourceKey, targetPlaceholder] of Object.entries(edge.inputMapping)) {
                    // Simple placeholder replacement for now. 
                    // Future: Add JSON path or regex extraction from sourceKey.
                    prompt = prompt.replace(new RegExp(`\\{\\{${targetPlaceholder}\\}\\}`, 'g'), parentOutput);
                }
            } else {
                // Default: replace source node ID placeholder
                prompt = prompt.replace(new RegExp(`\\{\\{${edge.sourceId}\\}\\}`, 'g'), parentOutput);
            }
        }

        return prompt;
    }
}

export const agentGraphService = new AgentGraphService();
