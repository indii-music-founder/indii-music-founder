import { CustomNode, CustomEdge } from '../types';

export interface ADKGraph {
    name: string;
    description: string;
    nodes: Record<string, ADKNode>;
    edges: ADKEdge[];
    version: string;
}

export interface ADKNode {
    type: string;
    agentType?: string;
    taskId?: string;
    instruction?: string;
    config?: Record<string, unknown>;
}

export interface ADKEdge {
    from: string;
    to: string;
    condition?: string;
}

/**
 * Generates an Agent Development Kit (ADK) compliant JSON manifest
 * from the React Flow visual node graph.
 */
export function generateADKManifest(
    name: string,
    description: string,
    nodes: CustomNode[],
    edges: CustomEdge[]
): ADKGraph {
    const adkNodes: Record<string, ADKNode> = {};
    const adkEdges: ADKEdge[] = [];

    // Map React Flow nodes to ADK nodes
    nodes.forEach(node => {
        const adkNode: ADKNode = {
            type: node.type || node.data.nodeType || 'unknown'
        };

        if (node.data.nodeType === 'department') {
            adkNode.type = 'AgentNode';
            adkNode.agentType = node.data.departmentName;
            adkNode.instruction = node.data.prompt;
            adkNode.taskId = node.data.selectedJobId;
        } else if (node.data.nodeType === 'input') {
            adkNode.type = 'Entrypoint';
            adkNode.instruction = node.data.prompt;
        } else if (node.data.nodeType === 'output') {
            adkNode.type = 'Exitpoint';
        } else if (node.data.nodeType === 'logic') {
            adkNode.type = 'RouterNode';
            adkNode.config = node.data.config;
        }

        adkNodes[node.id] = adkNode;
    });

    // Map React Flow edges to ADK edges
    edges.forEach(edge => {
        adkEdges.push({
            from: edge.source,
            to: edge.target
        });
    });

    return {
        name: name || 'indiiOS Workflow',
        description: description || 'Exported ADK Graph from indiiOS Workflow Lab',
        nodes: adkNodes,
        edges: adkEdges,
        version: '1.0'
    };
}
