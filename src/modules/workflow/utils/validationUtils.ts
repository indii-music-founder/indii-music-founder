import { Connection, Node } from 'reactflow';
import { getJobDefinition } from '../services/nodeRegistry';

export const getHandleType = (node: Node, handleId: string | null, isSource: boolean): string => {
    if (!handleId) return 'ANY';

    if (node.type === 'inputNode') {
        return isSource ? 'TRIGGER' : 'ANY';
    }
    if (node.type === 'outputNode') {
        return !isSource ? 'ANY' : 'ANY';
    }
    if (node.type === 'audioSegmentNode') {
        return isSource ? 'AUDIO' : 'ANY';
    }

    // For Department/Logic nodes, look up registry
    const deptName = node.data.departmentName;
    const jobId = node.data.selectedJobId;

    const job = getJobDefinition(deptName, jobId);
    if (!job) return 'ANY';

    if (isSource) {
        const output = job.outputs.find((o: any) => o.id === handleId);
        return output ? output.type : 'ANY';
    } else {
        const input = job.inputs.find((i: any) => i.id === handleId);
        return input ? input.type : 'ANY';
    }
};

export const validateConnection = (sourceNode: Node, targetNode: Node, sourceHandle: string | null, targetHandle: string | null): boolean => {
    if (!sourceNode || !targetNode) return false;

    const sourceType = getHandleType(sourceNode, sourceHandle, true);
    const targetType = getHandleType(targetNode, targetHandle, false);

    // Type Compatibility Check
    if (sourceType === 'ANY' || targetType === 'ANY') return true;
    if (sourceType === targetType) return true;

    // Specific compatibility rules
    // Allow TEXT -> CONTEXT
    if (sourceType === 'TEXT' && targetType === 'CONTEXT') return true;

    return false;
};
