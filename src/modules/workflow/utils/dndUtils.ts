import { XYPosition } from 'reactflow';
import { Status } from '../types';

export const createNodeFromDrop = (
    event: React.DragEvent,
    position: XYPosition,
    addNode: (node: any) => void
) => {
    const nodeType = event.dataTransfer.getData('application/reactflow');

    if (nodeType === 'departmentNode') {
        const departmentName = event.dataTransfer.getData('application/departmentName');
        const newNode = {
            id: `${departmentName.replace(/\s+/g, '')}-${+new Date()}`,
            type: 'departmentNode',
            position,
            data: {
                nodeType: 'department',
                departmentName: departmentName,
                status: Status.PENDING
            },
        };
        addNode(newNode);
        return;
    }

    if (nodeType === 'logicNode') {
        const departmentName = event.dataTransfer.getData('application/departmentName'); // 'Logic'
        const jobId = event.dataTransfer.getData('application/jobId');
        const newNode = {
            id: `logic-${jobId}-${+new Date()}`,
            type: 'logicNode',
            position,
            data: {
                nodeType: 'logic',
                departmentName: departmentName, // Used by UniversalNode to look up registry
                selectedJobId: jobId,
                label: jobId === 'router' ? 'Router' : 'Gatekeeper',
                status: Status.PENDING,
                config: {}
            },
        };
        addNode(newNode);
        return;
    }

    if (nodeType === 'inputNode') {
        const newNode = {
            id: `input-${+new Date()}`,
            type: 'inputNode',
            position,
            data: {
                nodeType: 'input',
                prompt: 'Enter your prompt here...',
                status: Status.PENDING
            },
        };
        addNode(newNode);
        return;
    }

    if (nodeType === 'outputNode') {
        const newNode = {
            id: `output-${+new Date()}`,
            type: 'outputNode',
            position,
            data: {
                nodeType: 'output',
                status: Status.PENDING
            },
        };
        addNode(newNode);
        return;
    }

    const audioSegmentData = event.dataTransfer.getData('application/audiosegment');
    if (audioSegmentData) {
        const { label, start, end } = JSON.parse(audioSegmentData);
        const newNode = {
            id: `audio-segment-${+new Date()}`,
            type: 'audioSegmentNode',
            position,
            data: {
                nodeType: 'audioSegment',
                segmentLabel: label,
                startTime: start,
                endTime: end,
            },
        };
        addNode(newNode);
        return;
    }
};
