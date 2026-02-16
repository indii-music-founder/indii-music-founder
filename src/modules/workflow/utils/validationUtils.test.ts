import { describe, it, expect, vi } from 'vitest';
import { validateConnection, getHandleType } from './validationUtils';
import { Node } from 'reactflow';

// Mock getJobDefinition
vi.mock('../services/nodeRegistry', () => ({
    getJobDefinition: (deptName: string, jobId: string) => {
        if (deptName === 'Knowledge Base') {
            return {
                inputs: [
                    { id: 'trigger', type: 'TRIGGER' },
                    { id: 'query', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', type: 'TRIGGER' },
                    { id: 'answer', type: 'TEXT' }
                ]
            };
        }
        if (deptName === 'Video Department') {
            return {
                inputs: [
                    { id: 'trigger', type: 'TRIGGER' },
                    { id: 'video_input', type: 'VIDEO' }
                ],
                outputs: [
                    { id: 'trigger_out', type: 'TRIGGER' },
                    { id: 'video_output', type: 'VIDEO' }
                ]
            };
        }
        return null;
    }
}));

describe('validationUtils', () => {
    const inputNode: Node = {
        id: '1',
        type: 'inputNode',
        position: { x: 0, y: 0 },
        data: { label: 'Start' }
    };

    const outputNode: Node = {
        id: '2',
        type: 'outputNode',
        position: { x: 0, y: 0 },
        data: { label: 'End' }
    };

    const kbNode: Node = {
        id: '3',
        type: 'departmentNode',
        position: { x: 0, y: 0 },
        data: { departmentName: 'Knowledge Base', selectedJobId: 'kb-query' }
    };

    const videoNode: Node = {
        id: '4',
        type: 'departmentNode',
        position: { x: 0, y: 0 },
        data: { departmentName: 'Video Department', selectedJobId: 'video-job' }
    };

    it('allows Input (TRIGGER) -> Department (TRIGGER)', () => {
        expect(validateConnection(inputNode, kbNode, 'output', 'trigger')).toBe(true);
    });

    it('allows Department (TRIGGER) -> Output (ANY)', () => {
        expect(validateConnection(kbNode, outputNode, 'trigger_out', 'input')).toBe(true);
    });

    it('allows Department (TEXT) -> Output (ANY)', () => {
        expect(validateConnection(kbNode, outputNode, 'answer', 'input')).toBe(true);
    });

    it('denies TEXT -> VIDEO', () => {
        expect(validateConnection(kbNode, videoNode, 'answer', 'video_input')).toBe(false);
    });

    it('allows VIDEO -> VIDEO', () => {
        // Create another video node for source
        const videoSource: Node = { ...videoNode, id: '5' };
        expect(validateConnection(videoSource, videoNode, 'video_output', 'video_input')).toBe(true);
    });

    it('denies TRIGGER -> TEXT', () => {
        expect(validateConnection(inputNode, kbNode, 'output', 'query')).toBe(false);
    });
});
