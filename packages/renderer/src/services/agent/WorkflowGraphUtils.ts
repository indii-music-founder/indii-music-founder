import type { WorkflowDefinition } from './WorkflowRegistry';
import { logger } from '@/utils/logger';

/**
 * Validates a workflow graph for cyclic dependencies and broken links.
 * Uses a Depth-First Search (DFS) algorithm to ensure it's a Directed Acyclic Graph (DAG).
 * 
 * @throws Error if a cycle is detected or an edge references a non-existent step.
 */
export function validateWorkflowGraph(workflow: WorkflowDefinition): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list from edges
    const adjList = new Map<string, string[]>();
    const stepIds = new Set<string>();
    
    for (const step of workflow.steps) {
        adjList.set(step.id, []);
        stepIds.add(step.id);
    }
    
    for (const edge of workflow.edges) {
        if (!stepIds.has(edge.from)) {
            throw new Error(`[WorkflowGraph] Invalid edge in '${workflow.id}': Source step '${edge.from}' does not exist.`);
        }
        if (!stepIds.has(edge.to)) {
            throw new Error(`[WorkflowGraph] Invalid edge in '${workflow.id}': Target step '${edge.to}' does not exist.`);
        }
        
        const deps = adjList.get(edge.from);
        if (deps) {
            deps.push(edge.to);
        }
    }

    const dfs = (nodeId: string): boolean => {
        if (recursionStack.has(nodeId)) {
            return true; // Cycle detected
        }
        if (visited.has(nodeId)) {
            return false;
        }

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const neighbors = adjList.get(nodeId);
        if (neighbors) {
            for (const neighbor of neighbors) {
                if (dfs(neighbor)) return true;
            }
        }

        recursionStack.delete(nodeId);
        return false;
    };

    for (const step of workflow.steps) {
        if (!visited.has(step.id)) {
            if (dfs(step.id)) {
                throw new Error(`[WorkflowGraph] Cyclic dependency detected in workflow '${workflow.id}'.`);
            }
        }
    }

    logger.debug(`[WorkflowGraph] Successfully validated workflow '${workflow.id}'`);
}
