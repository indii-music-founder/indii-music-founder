import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import { 
    AgentGraph, 
    GraphNode, 
    GraphEdge, 
    AgentContext,
    VALID_AGENT_IDS,
    ValidAgentId
} from '../types';
import { GenAI as AI } from '@/services/ai/GenAI';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

/**
 * GraphDecompositionService — Dynamic DAG Generator
 * 
 * Pillar 3: Graph-Based Orchestration
 * 
 * This service uses high-reasoning AI to decompose a novel user request 
 * into a structured AgentGraph. This allows for truly autonomous, 
 * non-linear multi-agent coordination.
 */
export class GraphDecompositionService {

    /**
     * Decomposes a user query into a Directed Acyclic Graph (DAG) of agent tasks.
     */
    async decompose(userQuery: string, context: AgentContext): Promise<AgentGraph> {
        logger.info(`[GraphDecomposition] Decomposing query: "${userQuery.slice(0, 50)}..."`);

        const prompt = `
        You are the indii Architect, the high-reasoning engine responsible for decomposing complex user requests into Directed Acyclic Graphs (DAGs) of specialist agent tasks.
        
        USER REQUEST: "${userQuery}"
        
        CURRENT CONTEXT:
        - Active Module: ${context.activeModule || 'none'}
        - Project: ${context.projectHandle?.name || 'none'}
        
        AVAILABLE AGENTS:
        ${VALID_AGENT_IDS.join(', ')}
        
        YOUR TASK:
        1. Break down the user request into a set of independent or sequential tasks.
        2. Assign each task to the most appropriate specialist agent.
        3. Define the execution order (edges). Parallelize tasks that have no data dependency.
        4. Use placeholders like {{input}} for the initial user query.
        5. Use placeholders like {{nodeId}} to pass the output of a parent node to a child.
        
        OUTPUT SCHEMA (JSON):
        {
            "name": "string", // Descriptive name for the workflow
            "description": "string", // Detailed goal
            "nodes": [
                {
                    "id": "node_id_1", // unique alphanumeric slug
                    "agentId": "agent_id", // MUST be from AVAILABLE AGENTS
                    "taskTemplate": "Detailed instructions for the agent. Use {{input}} or {{parent_node_id}}.",
                    "waitCondition": "all" | "any"
                }
            ],
            "edges": [
                {
                    "sourceId": "node_id_1",
                    "targetId": "node_id_2",
                    "condition": "string", // Optional regex condition on parent output
                    "inputMapping": { "sourceKey": "targetPlaceholder" } // e.g. { "output": "brand_guide" }
                }
            ],
            "entryNodeId": "node_id_1"
        }
        
        RULES:
        - The graph MUST be acyclic (no loops).
        - Maximum 6 nodes for complexity management.
        - Ensure logical flow (e.g., brand analysis must happen before content generation).
        - If the request is simple, return a single-node graph.
        `;

        try {
            const response = await AI.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                AI_MODELS.TEXT.PRO, // Use Pro for complex architecture
                {
                    ...AI_CONFIG.THINKING.HIGH,
                    responseMimeType: 'application/json'
                }
            );

            const jsonText = response.response.text() || '{}';
            const rawGraph = JSON.parse(jsonText);

            // Validate and Polish
            const graph: AgentGraph = {
                id: uuidv4(),
                name: rawGraph.name || 'Dynamic Workflow',
                description: rawGraph.description || 'Generated from user query',
                nodes: this.validateNodes(rawGraph.nodes || []),
                edges: this.validateEdges(rawGraph.edges || []),
                entryNodeId: rawGraph.entryNodeId || (rawGraph.nodes?.[0]?.id),
                metadata: {
                    version: '1.0.0',
                    author: 'indii-architect',
                    createdAt: Date.now()
                }
            };

            this.ensureAcyclic(graph);
            
            logger.info(`[GraphDecomposition] Generated graph "${graph.name}" with ${graph.nodes.length} nodes.`);
            return graph;

        } catch (error: any) {
            logger.error('[GraphDecomposition] Decomposition failed:', error);
            // Fallback to a single-node generalist graph
            return this.createFallbackGraph(userQuery);
        }
    }

    private validateNodes(nodes: any[]): GraphNode[] {
        return nodes.map(n => ({
            id: String(n.id),
            agentId: VALID_AGENT_IDS.includes(n.agentId as ValidAgentId) ? (n.agentId as ValidAgentId) : 'generalist',
            taskTemplate: String(n.taskTemplate),
            waitCondition: n.waitCondition === 'any' ? 'any' : 'all',
            contextOverrides: n.contextOverrides || {}
        })).slice(0, 10); // Hard limit
    }

    private validateEdges(edges: any[]): GraphEdge[] {
        return edges.map(e => ({
            sourceId: String(e.sourceId),
            targetId: String(e.targetId),
            condition: e.condition ? String(e.condition) : undefined,
            inputMapping: e.inputMapping || {}
        }));
    }

    private ensureAcyclic(graph: AgentGraph) {
        // Simple DFS cycle detection
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (recStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recStack.add(nodeId);

            const neighbors = graph.edges.filter(e => e.sourceId === nodeId).map(e => e.targetId);
            for (const neighbor of neighbors) {
                if (hasCycle(neighbor)) return true;
            }

            recStack.delete(nodeId);
            return false;
        };

        for (const node of graph.nodes) {
            if (hasCycle(node.id)) {
                logger.warn(`[GraphDecomposition] Cycle detected at node ${node.id}. Pruning edges.`);
                // Basic recovery: remove edges causing cycle (naive but safe)
                graph.edges = graph.edges.filter(e => e.targetId !== node.id);
            }
        }
    }

    private createFallbackGraph(userQuery: string): AgentGraph {
        const nodeId = 'fallback_node';
        return {
            id: uuidv4(),
            name: 'Fallback Workflow',
            description: 'Simple single-agent routing',
            nodes: [{
                id: nodeId,
                agentId: 'generalist',
                taskTemplate: userQuery,
                waitCondition: 'all'
            }],
            edges: [],
            entryNodeId: nodeId,
            metadata: {
                version: '1.0.0',
                author: 'indii-architect',
                createdAt: Date.now()
            }
        };
    }
}

export const graphDecompositionService = new GraphDecompositionService();
