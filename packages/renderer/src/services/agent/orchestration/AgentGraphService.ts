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
     */
    async resumeGraph(executionId: string, context: AgentContext): Promise<string> {
        const userId = context.userId;
        if (!userId) throw new Error('userId is required for graph resumption');

        const state = await agentGraphStateService.getExecution(userId, executionId);
        if (!state) throw new Error(`Execution ${executionId} not found`);

        // We need the graph definition to resume. 
        // In a real system, we'd fetch it from a GraphRegistry.
        // For now, we assume the caller provides it or we log an error.
        logger.info(`[AgentGraph] Resuming graph execution: ${executionId}, state: ${state.status}`);

        // Re-enter the loop. Note: we might need to recover the initialInput from somewhere 
        // if it's not stored in the state. For now, we proceed with current context.
        return await this.runGraphLoop(userId, { id: state.graphId } as any, executionId, context, context.traceId || uuidv4());
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

        while (running) {
            const state = await agentGraphStateService.getExecution(userId, executionId);
            if (!state) throw new Error(`Execution ${executionId} lost during run`);

            if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
                running = false;
                break;
            }

            // 1. Identify ready nodes and handle conditional skipping
            const readyNodes: GraphNode[] = [];
            const nodesToSkip: string[] = [];

            // If graph is incomplete (e.g. during resumption), we need to fetch the full graph definition
            // Here we assume 'graph' is fully populated or we fetch it.
            
            for (const node of graph.nodes) {
                const nodeState = state.nodeStates[node.id];
                if (!nodeState || (nodeState.status !== 'planned' && nodeState.status !== 'failed')) continue;

                // Entry node is always ready if it's planned
                if (node.id === graph.entryNodeId) {
                    readyNodes.push(node);
                    continue;
                }

                // Check parents and conditions
                const incomingEdges = graph.edges.filter(e => e.targetId === node.id);
                if (incomingEdges.length === 0) continue; // Unreachable node unless entry

                const parentStates = incomingEdges.map(edge => ({
                    edge,
                    status: state.nodeStates[edge.sourceId]?.status,
                    output: state.nodeStates[edge.sourceId]?.output
                }));

                const allParentsFinished = parentStates.every(p => 
                    p.status === 'step_complete' || p.status === 'skipped' || p.status === 'failed'
                );

                if (!allParentsFinished) continue;

                // Evaluate wait condition and edge logic
                const validEdges = parentStates.filter(p => {
                    if (p.status !== 'step_complete') return false;
                    return this.evaluateCondition(p.edge.condition, p.output || '');
                });

                if (node.waitCondition === 'all') {
                    if (validEdges.length === incomingEdges.length) {
                        readyNodes.push(node);
                    } else if (parentStates.some(p => p.status === 'skipped' || (p.status === 'step_complete' && !validEdges.includes(p)))) {
                        nodesToSkip.push(node.id);
                    }
                } else { // 'any'
                    if (validEdges.length > 0) {
                        readyNodes.push(node);
                    } else if (parentStates.every(p => p.status === 'skipped' || (p.status === 'step_complete' && !validEdges.includes(p)))) {
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
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'completed');
                    running = false;
                } else if (!hasExecuting) {
                    logger.warn(`[AgentGraph] Graph execution stuck: unreachable planned nodes.`);
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'completed');
                    running = false;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                continue;
            }

            // 3. Prepare tasks for ready nodes with Memory Bank Integration
            const tasks = await Promise.all(readyNodes.map(async (node) => {
                const prompt = this.resolveNodePrompt(node, graph, state, initialInput);
                
                // GEAP Pillar 2: SCALE - Pull relevant memories before execution
                const memories = await memoryBankService.searchMemories(userId, prompt, 5);
                const memoryContext = memories.map(m => m.memory).join('\n---\n');

                return {
                    nodeId: node.id,
                    agentId: node.agentId,
                    prompt,
                    context: { 
                        ...context, 
                        ...node.contextOverrides, 
                        memoryContext,
                        relevantMemories: memories.map(m => m.memory),
                        traceId: `${traceId}/${node.id}` 
                    },
                    traceId: `${traceId}/${node.id}`
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
                        await memoryBankService.addMemory(userId, `[Graph Node: ${task.nodeId}] Result: ${response.slice(0, 1000)}`);
                        
                        return { nodeId: task.nodeId, success: true, output: response };
                    } catch (err: unknown) {
                        const error = err instanceof Error ? err : new Error(String(err));
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
                        
                        // In high-reliability mode, we fail the entire graph if any node fails 
                        // (unless we add retry logic or error branches)
                        await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                        running = false;
                    }
                }
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[AgentGraph] Loop execution failure:`, error);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'failed');
                running = false;
            }
        }

        return `Graph execution finished. Final output snippet: ${lastOutput.slice(0, 500)}...`;
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
