import { WorkflowDefinition } from '@/services/agent/WorkflowRegistry';
import { Node, Edge } from 'reactflow';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { v4 as uuidv4 } from 'uuid';
import { Status } from '../types';

const AGENT_DEPARTMENT_MAP: Record<string, { departmentName: string; selectedJobId?: string }> = {
    creative: { departmentName: 'Art Department', selectedJobId: 'art-department-job-0' },
    video: { departmentName: 'Video Department', selectedJobId: 'video-department-job-0' },
    marketing: { departmentName: 'Marketing Department', selectedJobId: 'marketing-department-job-0' },
    social: { departmentName: 'Social Media Department', selectedJobId: 'social-department-job-0' },
    brand: { departmentName: 'Campaign Manager' },
    publicist: { departmentName: 'Marketing Department', selectedJobId: 'marketing-department-job-0' },
    finance: { departmentName: 'Splits & Rights Department' },
    music: { departmentName: 'Music Department' },
    distribution: { departmentName: 'Distribution & Release Department' },
};

export function protocolToReactFlow(protocol: WorkflowDefinition): { nodes: Node[], edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Calculate depths for layout
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        const deptMapping = AGENT_DEPARTMENT_MAP[step.agentId];
        nodes.push({
            id: step.id,
            type: 'departmentNode', // Using WorkflowLab's departmentNode
            position: { x, y },
            data: {
                nodeType: 'department',
                label: step.id,
                departmentName: deptMapping?.departmentName ?? step.agentId,
                ...(deptMapping?.selectedJobId ? { selectedJobId: deptMapping.selectedJobId } : {}),
                status: Status.PENDING,
                // store original data so we know it's a maestro protocol node
                maestroNode: true,
                agentId: step.agentId,
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
