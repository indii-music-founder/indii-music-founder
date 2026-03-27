import { XYPosition, Node } from 'reactflow';
import { Status } from '../types';
import { logger } from '@/utils/logger';


export const createNodeFromDrop = (
    event: React.DragEvent,
    position: XYPosition,
    addNode: (node: Node) => void

) => {
    const nodeType = event.dataTransfer.getData('application/reactflow');

    if (nodeType === 'departmentNode') {
        const departmentName = event.dataTransfer.getData('application/departmentName');
        const newNode = {
            id: `${departmentName.replace(/\s+/g, '')}-${crypto.randomUUID().slice(0, 8)}`,
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
            id: `logic-${jobId}-${crypto.randomUUID().slice(0, 8)}`,
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
            id: `input-${crypto.randomUUID().slice(0, 8)}`,
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
            id: `output-${crypto.randomUUID().slice(0, 8)}`,
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
        let label, start, end;
        try {
            const parsed = JSON.parse(audioSegmentData);
            label = parsed.label;
            start = parsed.start;
            end = parsed.end;
        } catch (e) {
            logger.error("Failed to parse audio segment data", e);
            return;
        }

        const newNode = {
            id: `audio-segment-${crypto.randomUUID().slice(0, 8)}`,
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
