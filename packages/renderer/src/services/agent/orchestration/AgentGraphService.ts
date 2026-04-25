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
     * Initializes a new graph execution state in persistence.
     * Useful when the caller needs the execution ID before starting the loop.
     */
    async createExecution(userId: string, graph: AgentGraph): Promise<GraphExecutionState> {
        return await agentGraphStateService.createExecution(userId, graph);
    }

    /**
     * Executes an entire AgentGraph from scratch.
     */
    async executeGraph(
        graph: AgentGraph, 
        context: AgentContext, 
        initialInput?: string,
        existingExecutionId?: string
    ): Promise<string> {
        const userId = context.userId;
        if (!userId) throw new Error('userId is required for graph execution');

        const traceId = context.traceId || uuidv4();
        
        let executionId = existingExecutionId;
        if (!executionId) {
            const state = await this.createExecution(userId, graph);
            executionId = state.executionId;
        }

        logger.info(`[AgentGraph] Starting graph execution: ${graph.name} (${graph.id}), trace: ${traceId}, execution: ${executionId}`);
        
        AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_STARTED', graph.id, executionId, `Name: ${graph.name}`);

        try {
            const result = await this.runGraphLoop(userId, graph, executionId, context, traceId, initialInput);
            AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_COMPLETED', graph.id, executionId);
            return result;
        } catch (error: any) {
            AgentEventBus.emitGraphEvent('GRAPH_EXECUTION_FAILED', graph.id, executionId, error.message);
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

        const graphToUse = graph; 
        if (!graphToUse) throw new Error(`Graph definition required to resume execution ${executionId}`);

        return await this.runGraphLoop(userId, graphToUse, executionId, context, context.traceId || uuidv4());
    }

    /**
     * Retries a specific failed node.
     * Pillar 3: Persistence & Scalability
     */
    async retryNode(userId: string, executionId: string, nodeId: string): Promise<void> {
        logger.info(`[AgentGraph] Retrying node ${nodeId} in execution ${executionId}`);
        await agentGraphStateService.updateNodeStatus(userId, executionId, nodeId, {
            status: 'planned',
            error: undefined
        });
        // Note: The main loop (if running) will pick this up automatically.
    }

    /**
     * Resets a node and all its downstream descendants to 'planned' state.
     * Useful for correcting a path and re-running.
     */
    async resetBranch(userId: string, executionId: string, nodeId: string, graph: AgentGraph): Promise<void> {
        logger.info(`[AgentGraph] Resetting branch starting at ${nodeId}`);
        
        const descendants = this.getDescendants(nodeId, graph);
        const nodesToReset = [nodeId, ...descendants];

        for (const id of nodesToReset) {
            await agentGraphStateService.updateNodeStatus(userId, executionId, id, {
                status: 'planned',
                output: undefined,
                error: undefined,
                startedAt: undefined,
                completedAt: undefined
            });
        }
    }

    private getDescendants(nodeId: string, graph: AgentGraph): string[] {
        const descendants: string[] = [];
        const queue = [nodeId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const children = graph.edges
                .filter(e => e.sourceId === current)
                .map(e => e.targetId);
            
            for (const child of children) {
                descendants.push(child);
                queue.push(child);
            }
        }
        return Array.from(new Set(descendants));
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

        // Preserve initial input in state for resumption
        if (initialInput) {
            await agentGraphStateService.updateExecutionMetadata(userId, executionId, { initialInput });
        }

        while (running) {
            iteration++;
            if (iteration > MAX_ITERATIONS) {
                logger.error(`[AgentGraph] Execution ${executionId} exceeded MAX_ITERATIONS (${MAX_ITERATIONS}). Potential cycle detected.`);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                throw new Error('Maximum graph iterations exceeded');
            }

            const state = await agentGraphStateService.getExecution(userId, executionId);
            if (!state) throw new Error(`Execution ${executionId} lost during run`);

            // If we are resuming, pull initialInput from state if not provided
            const inputToUse = initialInput || state.metadata?.initialInput;

            if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
                running = false;
                break;
            }

            // 1. Identify ready nodes and handle conditional skipping
            const readyNodes: GraphNode[] = [];
            const nodesToSkip: string[] = [];
            let isWaitingForApproval = false;
            
            for (const node of graph.nodes) {
                const nodeState = state.nodeStates[node.id];
                
                // HITL check: If any node is waiting for approval, the loop pauses execution
                if (nodeState?.status === 'awaiting_approval') {
                    isWaitingForApproval = true;
                    continue;
                }

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

            if (isWaitingForApproval) {
                logger.info(`[AgentGraph] Execution ${executionId} paused: Waiting for human approval.`);
                // We don't terminate the loop, but we sleep to avoid CPU spinning
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
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
                const prompt = this.resolveNodePrompt(node, graph, state, inputToUse);
                
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

        const finalReport = `Graph execution finished. Final output snippet: ${lastOutput.slice(0, 200)}...`;
        
        // GEAP Pillar 2: SCALE - Index completed graph for future RAG retrieval
        try {
            const inputToUse = initialInput || (await agentGraphStateService.getExecution(userId, executionId))?.metadata?.initialInput;
            if (inputToUse) {
                await memoryBankService.indexGraphExecution(userId, executionId, inputToUse, finalReport);
            }
        } catch (memErr) {
            logger.warn(`[AgentGraph] Failed to index completed graph ${executionId}`, memErr);
        }

        return finalReport;
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
        } catch (_e) {
            return output.includes(condition);
        }
    }


    /**
     * Resolves placeholders in the task template using parent outputs and initial input.
     * Supports JSONPath-like extraction if inputMapping is provided.
     */
    private resolveNodePrompt(node: GraphNode, graph: AgentGraph, state: GraphExecutionState, initialInput?: string): string {
        let prompt = node.taskTemplate;

        // 1. Replace global input placeholder
        if (initialInput) {
            prompt = prompt.replace(/\{\{input\}\}/g, initialInput);
        }

        // 2. Resolve data flow from parents
        const parentEdges = graph.edges.filter(e => e.targetId === node.id);
        
        for (const edge of parentEdges) {
            const parentState = state.nodeStates[edge.sourceId];
            if (!parentState || parentState.status !== 'step_complete') continue;

            const parentOutput = parentState.output || '';
            
            // Handle specific input mappings (Pillar 3: Data Flow)
            if (edge.inputMapping && Object.keys(edge.inputMapping).length > 0) {
                for (const [sourceKey, targetPlaceholder] of Object.entries(edge.inputMapping)) {
                    let extractedValue = parentOutput;

                    // Support JSON extraction if sourceKey is not 'output' or '*'
                    if (sourceKey !== 'output' && sourceKey !== '*') {
                        try {
                            const parsed = JSON.parse(parentOutput);
                            // Enhanced extraction supporting nested paths (e.g., "data.summary")
                            const value = this.getNestedValue(parsed, sourceKey);
                            extractedValue = value !== undefined ? String(value) : parentOutput;
                        } catch (_e) {
                            // If not JSON or path doesn't exist, use the raw output
                            extractedValue = parentOutput;
                        }
                    }

                    const placeholderRegex = new RegExp(`\\{\\{${targetPlaceholder}\\}\\}`, 'g');
                    prompt = prompt.replace(placeholderRegex, extractedValue);
                }
            } else {
                // Default fallback: replace {{sourceNodeId}} with the full parent output
                const defaultRegex = new RegExp(`\\{\\{${edge.sourceId}\\}\\}`, 'g');
                prompt = prompt.replace(defaultRegex, parentOutput);
            }
        }

        // 3. Final Cleanup: If any placeholders remain from non-existent inputs, 
        // we might want to warn or strip them. For now, leave them as is for visibility.
        return prompt;
    }

    /**
     * Safely retrieves a nested value from an object using a dot-notated path.
     */
    private getNestedValue(obj: any, path: string): any {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((prev, curr) => {
            return prev ? prev[curr] : undefined;
        }, obj);
    }
}

export const agentGraphService = new AgentGraphService();
