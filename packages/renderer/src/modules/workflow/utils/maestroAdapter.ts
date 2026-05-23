import { WorkflowDefinition } from '@/services/agent/WorkflowRegistry';
import { Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { Status } from '../types';

export function protocolToReactFlow(protocol: WorkflowDefinition): { nodes: Node[], edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Calculate depths for layout
    const depths: Record<string, number> = {};
    const getDepth = (nodeId: string, visited = new Set<string>()): number => {
        if (visited.has(nodeId)) return 0;
        visited.add(nodeId);
        const incomingEdges = protocol.edges.filter(e => e.to === nodeId);
        if (incomingEdges.length === 0) return 0;
        return Math.max(...incomingEdges.map(e => getDepth(e.from, visited))) + 1;
    };

    const nodeLevels: Record<string, number> = {};
    const nodesPerLevel: Record<number, number> = {};

    protocol.steps.forEach(step => {
        const level = getDepth(step.id);
        nodeLevels[step.id] = level;
        nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
    });

    const currentNodesInLevel: Record<number, number> = {};

    protocol.steps.forEach(step => {
        const level = nodeLevels[step.id] || 0;
        const index = currentNodesInLevel[level] || 0;
        currentNodesInLevel[level] = index + 1;

        const x = level * 350 + 50;
        const y = index * 150 + 50;

        nodes.push({
            id: step.id,
            type: 'departmentNode', // Using WorkflowLab's departmentNode
            position: { x, y },
            data: {
                label: step.id,
                departmentName: step.agentId,
                status: Status.PENDING,
                // store original data so we know it's a maestro protocol node
                maestroNode: true,
                prompt: step.prompt,
                priority: step.priority,
            }
        });
    });

    protocol.edges.forEach(edge => {
        edges.push({
            id: `edge-${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            type: 'smoothstep',
            animated: true,
        });
    });

    return { nodes, edges };
}
