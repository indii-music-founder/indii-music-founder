import { v4 as uuidv4 } from 'uuid';
import { WORKFLOW_TEMPLATES } from './workflowTemplates';
import { Status, type SavedWorkflow } from '../types';

export type QuickWorkflowTemplateId = 'template-simple-image' | 'template-video-teaser' | 'template-music-release';

/** Create a fresh Flow-Be canvas from a reviewed quick-job template. */
export function instantiateQuickWorkflow(
    templateId: QuickWorkflowTemplateId,
    prompt?: string,
): Pick<SavedWorkflow, 'id' | 'name' | 'description' | 'nodes' | 'edges' | 'viewport'> | null {
    const template = WORKFLOW_TEMPLATES.find(candidate => candidate.id === templateId);
    if (!template) return null;

    const idMap = new Map<string, string>();
    const nodes = template.nodes.map(node => {
        const id = node.id === 'start' || node.id === 'end' ? node.id : uuidv4();
        idMap.set(node.id, id);
        return {
            ...node,
            id,
            data: {
                ...node.data,
                ...(node.data.nodeType === 'input' && prompt ? { prompt } : {}),
                status: Status.PENDING,
            },
        };
    });
    const edges = template.edges.map(edge => ({
        ...edge,
        id: uuidv4(),
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
    }));

    return {
        id: template.id,
        name: template.name,
        description: template.description,
        nodes,
        edges,
        viewport: template.viewport,
    };
}
