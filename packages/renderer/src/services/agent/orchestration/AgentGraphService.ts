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
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/services/firebase';

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
     * One loop per execution id. resumeGraph/retry-resume must never start a
     * second loop against a live one — the live loop re-reads state every
     * iteration and picks up reset/retried nodes itself; a second loop would
     * just double-execute nodes.
     */
    private activeLoops = new Set<string>();

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            status: 'PLANNED',
            error: undefined
        });
        // Note: The main loop (if running) will pick this up automatically.
    }

    /**
     * Resets a node and all its downstream descendants to 'PLANNED' state.
     * Useful for correcting a path and re-running.
     */
    async resetBranch(userId: string, executionId: string, nodeId: string, graph: AgentGraph): Promise<void> {
        logger.info(`[AgentGraph] Resetting branch starting at ${nodeId}`);

        const descendants = this.getDescendants(nodeId, graph);
        const nodesToReset = [nodeId, ...descendants];

        for (const id of nodesToReset) {
            await agentGraphStateService.updateNodeStatus(userId, executionId, id, {
                status: 'PLANNED',
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
        if (this.activeLoops.has(executionId)) {
            throw new Error(`Graph execution ${executionId} already has an active loop.`);
        }
        this.activeLoops.add(executionId);

        const runnerId = uuidv4();
        const acquired = await this.acquireGraphLease(userId, executionId, runnerId);
        if (!acquired) {
            this.activeLoops.delete(executionId);
            throw new Error(`Graph execution ${executionId} is locked by another runner.`);
        }

        // Arm 5-second lease heartbeat
        const heartbeatTimer = setInterval(() => {
            this.acquireGraphLease(userId, executionId, runnerId, 20000).catch(err => {
                logger.warn(`[AgentGraph] Heartbeat lease renewal failed for ${executionId}:`, err);
            });
        }, 5000);

        try {
            return await this.runGraphLoopInternal(userId, graph, executionId, context, traceId, initialInput);
        } finally {
            clearInterval(heartbeatTimer);
            await this.releaseGraphLease(userId, executionId, runnerId);
            this.activeLoops.delete(executionId);
        }
    }

    /**
     * Atomically acquire or renew a distributed execution lease on the graph execution document.
     * Prevents multi-instance concurrent graph execution loops while allowing expired leases (>20s) to be claimed.
     */
    private async acquireGraphLease(
        userId: string,
        executionId: string,
        runnerId: string,
        leaseDurationMs = 20000
    ): Promise<boolean> {
        const ref = doc(db, 'users', userId, 'graphExecutions', executionId);
        try {
            return await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists) return false;
                const data = (typeof (snap as any).data === 'function' ? (snap as any).data() : (snap as any).data) as GraphExecutionState;
                const now = Date.now();
                const existingLease = data?.lease;

                if (existingLease && existingLease.expiresAt > now && existingLease.holderId !== runnerId) {
                    logger.warn(`[AgentGraph] Execution ${executionId} is actively leased by ${existingLease.holderId} until ${new Date(existingLease.expiresAt).toISOString()}`);
                    return false;
                }

                tx.update(ref, {
                    lease: {
                        holderId: runnerId,
                        acquiredAt: existingLease?.holderId === runnerId ? existingLease.acquiredAt : now,
                        expiresAt: now + leaseDurationMs,
                    },
                    updatedAt: now,
                });
                return true;
            });
        } catch (error) {
            logger.warn(`[AgentGraph] Failed to acquire distributed lease for ${executionId}:`, error);
            return false;
        }
    }

    private async releaseGraphLease(
        userId: string,
        executionId: string,
        runnerId: string
    ): Promise<void> {
        const ref = doc(db, 'users', userId, 'graphExecutions', executionId);
        try {
            await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists) return;
                const data = (typeof (snap as any).data === 'function' ? (snap as any).data() : (snap as any).data) as GraphExecutionState;
                if (data?.lease?.holderId === runnerId) {
                    tx.update(ref, {
                        lease: null,
                        updatedAt: Date.now(),
                    });
                }
            });
        } catch (error) {
            logger.warn(`[AgentGraph] Failed to release lease for ${executionId}:`, error);
        }
    }

    /**
     * Atomically claim a node for execution. The readiness computation in
     * runGraphLoopInternal reads a state snapshot; two loop instances can
     * observe the same PLANNED node from their own snapshots. This
     * transaction only succeeds while the node is still PLANNED, so exactly
     * one loop wins each node — the loser's claim returns false and the node
     * is skipped, never double-executed.
     */
    private async claimNodeAtomically(
        userId: string,
        executionId: string,
        nodeId: string,
    ): Promise<boolean> {
        const ref = doc(db, 'users', userId, 'graphExecutions', executionId);
        try {
            return await runTransaction(db, async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists) return false;
                const data = snap.data() as {
                    nodeStates?: Record<string, { status?: string }>;
                };
                const nodeState = data.nodeStates?.[nodeId];
                if (!nodeState || nodeState.status !== 'PLANNED') return false;
                tx.update(ref, {
                    [`nodeStates.${nodeId}.status`]: 'EXECUTING_GENERATION',
                    [`nodeStates.${nodeId}.startedAt`]: Date.now(),
                    status: 'EXECUTING',
                });
                return true;
            });
        } catch (error) {
            logger.warn(`[AgentGraph] Atomic claim failed for node ${nodeId} in ${executionId}:`, error);
            return false;
        }
    }

    private async runGraphLoopInternal(
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
        const MAX_ITERATIONS = 50; // Safety break - lowered from 1000 to prevent expensive runaways
        const startTime = Date.now();
        let lastProgressTime = Date.now();
        const MAX_EXECUTION_TIME_MS = 270000; // 270s hard limit per skills/firestore-transaction-locks.md
        const MAX_IDLE_TIME_MS = 60000; // 60s idle limit

        // Preserve initial input in state for resumption
        if (initialInput) {
            await agentGraphStateService.updateExecutionMetadata(userId, executionId, { initialInput });
        }

        while (running) {
            iteration++;
            const now = Date.now();

            if (now - startTime > MAX_EXECUTION_TIME_MS) {
                logger.error(`[AgentGraph] Execution ${executionId} exceeded 270s maximum execution deadline.`);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                throw new Error('Maximum graph execution time exceeded (270s)');
            }

            if (iteration > MAX_ITERATIONS) {
                logger.error(`[AgentGraph] Execution ${executionId} exceeded MAX_ITERATIONS (${MAX_ITERATIONS}). Potential cycle detected.`);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                throw new Error('Maximum graph iterations exceeded');
            }

            const state = await agentGraphStateService.getExecution(userId, executionId);
            if (!state) throw new Error(`Execution ${executionId} lost during run`);

            // If we are resuming, pull initialInput from state if not provided
            const inputToUse = initialInput || state.metadata?.initialInput;

            if (state.status === 'FAILED') {
                throw new Error(`Graph execution ${executionId} is failed.`);
            }
            if (state.status === 'CANCELLED') {
                throw new Error(`Graph execution ${executionId} was cancelled.`);
            }
            if (state.status === 'COMPLETED') {
                running = false;
                break;
            }

            // 1. Identify ready nodes and handle conditional skipping
            const readyNodes: GraphNode[] = [];
            const nodesToSkip: string[] = [];
            let isWaitingForApproval = false;

            for (const node of graph.nodes) {
                const nodeState = state.nodeStates[node.id];

                // If already completed or skipped or failed, do nothing
                if (nodeState && nodeState.status !== 'PLANNED') continue;

                // Approval check (Human in the loop)
                if (node.requiresApproval) {
                    // Check if parent dependencies are met first
                    const incoming = graph.edges.filter(e => e.targetId === node.id);
                    const parentsDone = incoming.every(e => state.nodeStates[e.sourceId]?.status === 'STEP_COMPLETE');

                    if (parentsDone && (!nodeState || nodeState.status === 'PLANNED')) {
                        // Mark as awaiting human approval
                        await agentGraphStateService.updateNodeStatus(userId, executionId, node.id, {
                            status: 'AWAITING_HUMAN'
                        });
                        isWaitingForApproval = true;
                        continue;
                    } else if (nodeState?.status === 'AWAITING_HUMAN') {
                        isWaitingForApproval = true;
                        continue;
                    }
                }

                // Entry node is always ready if not run yet
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
                p.sourceState && (p.sourceState.status === 'STEP_COMPLETE' || p.sourceState.status === 'SKIPPED' || p.sourceState.status === 'FAILED')
                );

                if (!allParentsProcessed) continue;

                // Evaluate wait condition and edge logic
                const validEdges = parentStates.filter(p => {
                    if (!p.sourceState || p.sourceState.status !== 'STEP_COMPLETE') return false;
                    return this.evaluateCondition(p.edge.condition, p.sourceState.output || '');
                });

                if (node.waitCondition === 'all') {
                    // All incoming paths that lead here must have succeeded AND their conditions must match
                    if (validEdges.length === incomingEdges.length) {
                        readyNodes.push(node);
                    } else {
                        // Node cannot run because its condition wasn't met -> prune branch
                        nodesToSkip.push(node.id);
                    }
                } else if (node.waitCondition === 'any') {
                    // At least one incoming path succeeded
                    if (validEdges.length > 0) {
                        readyNodes.push(node);
                    } else {
                        // None succeeded -> prune
                        nodesToSkip.push(node.id);
                    }
                }
            }

            // Apply branch pruning for nodes whose conditions failed
            if (nodesToSkip.length > 0) {
                logger.info(`[AgentGraph] Iteration ${iteration}: Condition failed for nodes: ${nodesToSkip.join(', ')}. Pruning branches.`);
                for (const skipId of nodesToSkip) {
                    await agentGraphStateService.updateNodeStatus(userId, executionId, skipId, {
                        status: 'SKIPPED',
                        completedAt: Date.now()
                    });
                    await this.pruneDescendants(userId, executionId, skipId, graph);
                }
            }

            if (isWaitingForApproval) {
                logger.info(`[AgentGraph] Execution ${executionId} paused: Waiting for human approval.`);
                // We don't terminate the loop, but we sleep to avoid CPU spinning
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            // Skipped-state writes above are not reflected in the state snapshot
            // used by this iteration. Refresh before deciding whether the graph
            // is stuck or terminal.
            if (readyNodes.length === 0 && nodesToSkip.length > 0) {
                continue;
            }

            if (readyNodes.length === 0) {
                const hasPlanned = graph.nodes.some(n => state.nodeStates[n.id]?.status === 'PLANNED');
                const hasExecuting = graph.nodes.some(n => state.nodeStates[n.id]?.status === 'EXECUTING_GENERATION');
                const failedNodeIds = graph.nodes
                    .filter(n => state.nodeStates[n.id]?.status === 'FAILED')
                    .map(n => n.id);

                if (!hasPlanned && !hasExecuting) {
                    if (failedNodeIds.length > 0) {
                        await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                        throw new Error(`Graph execution ${executionId} failed at node(s): ${failedNodeIds.join(', ')}.`);
                    }
                    logger.info(`[AgentGraph] Execution ${executionId} complete (all reachable nodes resolved).`);
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'COMPLETED');
                    running = false;
                } else if (!hasExecuting) {
                    const plannedNodeIds = graph.nodes
                        .filter(n => state.nodeStates[n.id]?.status === 'PLANNED')
                        .map(n => n.id);
                    logger.error(`[AgentGraph] Graph execution ${executionId} stuck: unreachable planned nodes ${plannedNodeIds.join(', ')}.`);
                    await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                    throw new Error(`Graph execution ${executionId} is stuck with unreachable node(s): ${plannedNodeIds.join(', ')}.`);
                } else {
                    if (now - lastProgressTime > MAX_IDLE_TIME_MS) {
                        logger.error(`[AgentGraph] Execution ${executionId} exceeded 60s idle limit with background tasks pending.`);
                        await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                        throw new Error('Graph execution idle timeout exceeded (60s)');
                    }
                    // Wait for background tasks to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                continue;
            }

            // 2. ATOMIC NODE CLAIMING: claim candidate nodes through Firestore
            // transactions before touching memory retrieval or delegates. Only
            // nodes this loop successfully claimed move to task execution.
            const claimResults = await Promise.all(
                readyNodes.map(async (node) => ({
                    nodeId: node.id,
                    claimed: await this.claimNodeAtomically(userId, executionId, node.id),
                }))
            );
            const claimedNodeIds: string[] = [];
            for (const r of claimResults) {
                if (r.claimed) {
                    claimedNodeIds.push(r.nodeId);
                    AgentEventBus.emitNodeEvent('GRAPH_NODE_STARTED', graph.id, r.nodeId, executionId);
                }
            }

            if (claimedNodeIds.length > 0) {
                lastProgressTime = Date.now();
            }

            // 3. Mark the claimed nodes EXECUTING in local state so downstream
            // preparation observes the updated status.
            for (const nodeId of claimedNodeIds) {
                state.nodeStates[nodeId] = {
                    ...(state.nodeStates[nodeId] || { status: 'PLANNED' }),
                    status: 'EXECUTING_GENERATION',
                    startedAt: Date.now(),
                };
            }

            if (claimedNodeIds.length === 0) {
                logger.info(`[AgentGraph] Iteration ${iteration}: all candidate nodes claimed by another loop — re-evaluating.`);
                continue;
            }

            // 4. Prepare tasks for the CLAIMED nodes (memory retrieval happens
            // after the claim so a lost claim never does wasted work).
            logger.info(`[AgentGraph] Iteration ${iteration}: Starting ${claimedNodeIds.length} nodes in parallel: ${claimedNodeIds.join(', ')}`);

            const tasks = await Promise.all(claimedNodeIds.map(async (nodeId) => {
                const node = graph.nodes.find(candidate => candidate.id === nodeId);
                if (!node) throw new Error(`Graph node ${nodeId} missing from definition`);
                const prompt = this.resolveNodePrompt(node, graph, state, inputToUse);

                // GEAP Pillar 2: SCALE - Pull relevant memories before execution (capped to top 5 / 3,000 chars)
                let memoryContext = '';
                try {
                    const { results } = await memoryBankService.searchMemories(userId, prompt, 5);
                    const memoryLines: string[] = [];
                    let totalChars = 0;
                    for (const m of results) {
                        if (totalChars + m.memory.length > 3000) {
                            memoryLines.push(m.memory.slice(0, Math.max(0, 3000 - totalChars)) + '... [trimmed]');
                            break;
                        }
                        memoryLines.push(m.memory);
                        totalChars += m.memory.length;
                    }
                    memoryContext = memoryLines.join('\n---\n');
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
                            status: 'STEP_COMPLETE',
                            output: res.output,
                            completedAt: Date.now()
                        });
                        AgentEventBus.emitNodeEvent('GRAPH_NODE_COMPLETED', graph.id, res.nodeId, executionId);
                        lastOutput = res.output || '';
                        lastProgressTime = Date.now();
                    } else {
                        await agentGraphStateService.updateNodeStatus(userId, executionId, res.nodeId, {
                            status: 'FAILED',
                            error: res.error,
                            completedAt: Date.now()
                        });
                        AgentEventBus.emitNodeEvent('GRAPH_NODE_FAILED', graph.id, res.nodeId, executionId, res.error);
                        lastProgressTime = Date.now();

                        if (res.error) {
                            // Path Pruning: If a node fails, prune its descendants and mark them as skipped.
                            logger.warn(`[AgentGraph] Node ${res.nodeId} failed. Pruning descendants.`);
                            await this.pruneDescendants(userId, executionId, res.nodeId, graph);

                            const latestState = await agentGraphStateService.getExecution(userId, executionId);
                            const hasActiveNodes = latestState && Object.values(latestState.nodeStates).some(
                                s => s.status === 'PLANNED' || s.status === 'EXECUTING_GENERATION'
                            );

                            if (!hasActiveNodes) {
                                logger.error(`[AgentGraph] No successful path remains after node ${res.nodeId} failed.`);
                                await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                                throw new Error(`Graph node ${res.nodeId} failed: ${res.error || 'Unknown error'}`);
                            }
                            continue;
                        }
                    }
                }
            } catch (err: unknown) {
                const error = err instanceof Error ? err : new Error(String(err));
                logger.error(`[AgentGraph] Critical loop failure in ${executionId}:`, error);
                await agentGraphStateService.finalizeStatus(userId, executionId, 'FAILED');
                throw error;
            }

            // Yield briefly between iterations
            await new Promise(resolve => setTimeout(resolve, 100));
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
     * Evaluates a simple edge condition against parent output.
     * Supports basic operators like contains, equals, etc.
     */
    private evaluateCondition(condition?: string, output?: string): boolean {
        if (!condition) return true; // Unconditional edge
        if (!output) return false;

        // Simple condition DSL: "status:SUCCESS" or "contains:approved"
        if (condition.startsWith('contains:')) {
            const term = condition.substring('contains:'.length);
            return output.toLowerCase().includes(term.toLowerCase());
        } else if (condition.startsWith('equals:')) {
            const term = condition.substring('equals:'.length);
            return output.trim() === term.trim();
        } else if (condition.startsWith('not_contains:')) {
            const term = condition.substring('not_contains:'.length);
            return !output.toLowerCase().includes(term.toLowerCase());
        }

        try {
            const regex = new RegExp(condition, 'i');
            return regex.test(output);
        } catch (_e) {
            // Default: substring match
            return output.includes(condition);
        }
    }

    /**
     * Trims long outputs to a safe character budget to prevent context window explosion.
     */
    private trimForContext(text: string, maxChars = 10000): string {
        if (!text || text.length <= maxChars) return text;
        const head = text.slice(0, 7500);
        const tail = text.slice(-2500);
        return `${head}\n\n[... Output trimmed for context efficiency (${text.length - maxChars} chars omitted) ...]\n\n${tail}`;
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
            if (!parentState || parentState.status !== 'STEP_COMPLETE') continue;

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
                    prompt = prompt.replace(placeholderRegex, this.trimForContext(extractedValue));
                }
            } else {
                // Default fallback: replace {{sourceNodeId}} with the full parent output
                const defaultRegex = new RegExp(`\\{\\{${edge.sourceId}\\}\\}`, 'g');
                prompt = prompt.replace(defaultRegex, this.trimForContext(parentOutput));
            }
        }

        // 3. Handle Global JSONPath Resolution: {{nodeId.path}}
        // This allows nodes to reference ANY completed node in the graph, not just direct parents.
        const globalPlaceholderRegex = /\{\{([^.}]+)\.([^}]+)\}\}/g;
        let match;
        while ((match = globalPlaceholderRegex.exec(prompt)) !== null) {
            const [fullMatch, nodeId, path] = match as unknown as [string, string, string];
            const sourceState = state.nodeStates[nodeId];

            if (sourceState && sourceState.output) {
                try {
                    const parsed = JSON.parse(sourceState.output);
                    const value = this.getNestedValue(parsed, path);
                    if (value !== undefined) {
                        prompt = prompt.replace(fullMatch, this.trimForContext(String(value)));
                    }
                } catch (_e) {
                    // Ignore resolution errors for global paths
                }
            }
        }

        // 4. Final Cleanup: If any placeholders remain from non-existent inputs,
        // we might want to warn or strip them. For now, leave them as is for visibility.
        return prompt;
    }

    /**
     * Safely retrieves a nested value from an object using a dot-notated path.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getNestedValue(obj: any, path: string): any {
        if (!path || !obj) return undefined;
        return path.split('.').reduce((prev, curr) => {
            return prev ? prev[curr] : undefined;
        }, obj);
    }

    /**
     * Recursively prunes (skips) all descendant nodes of a failed node.
     */
    private async pruneDescendants(
        userId: string,
        executionId: string,
        failedNodeId: string,
        graph: AgentGraph,
        reason?: string
    ): Promise<void> {
        const queue = [failedNodeId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            // Find all nodes that depend on this node
            const descendants = graph.edges
                .filter(e => e.sourceId === currentId)
                .map(e => e.targetId);

            for (const descId of descendants) {
                if (!visited.has(descId)) {
                    logger.debug(`[AgentGraph] Pruning node ${descId} (descendant of ${failedNodeId})`);
                    await agentGraphStateService.updateNodeStatus(userId, executionId, descId, {
                        status: 'SKIPPED',
                        error: reason || `Skipped due to upstream failure in node: ${failedNodeId}`
                    });
                    queue.push(descId);
                }
            }
        }
    }
}

export const agentGraphService = new AgentGraphService();
