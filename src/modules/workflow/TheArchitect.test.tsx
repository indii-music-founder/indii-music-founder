import { describe, it, expect, vi } from 'vitest';
import { validateConnection } from './utils/validationUtils';
import { Node } from 'reactflow';

// Mock nodeRegistry
vi.mock('./services/nodeRegistry', () => ({
    getJobDefinition: (dept: string, jobId: string) => {
        if (dept === 'Music' && jobId === 'generate-track') {
            return {
                inputs: [{ id: 'style', type: 'TEXT' }, { id: 'tempo', type: 'NUMBER' }],
                outputs: [{ id: 'track', type: 'AUDIO' }]
            };
        }
        if (dept === 'Marketing' && jobId === 'social-post') {
            return {
                inputs: [{ id: 'media', type: 'AUDIO' }, { id: 'caption', type: 'TEXT' }],
                outputs: [{ id: 'post-url', type: 'URL' }]
            };
        }
        return null; // Fallback
    }
}));

describe('The Architect 📐', () => {
    // Define helper to create simple nodes
    const createNode = (id: string, type: string, data: any = {}): Node => ({
        id,
        type,
        data,
        position: { x: 0, y: 0 }
    });

    it('Scenario: The Blueprint - verifies valid connections flow downstream', () => {
        // Node A: Music Generator (Output: AUDIO)
        const nodeA = createNode('node-1', 'departmentNode', {
            departmentName: 'Music',
            selectedJobId: 'generate-track'
        });

        // Node B: Marketing (Input: AUDIO)
        const nodeB = createNode('node-2', 'departmentNode', {
            departmentName: 'Marketing',
            selectedJobId: 'social-post'
        });

        // Connect AUDIO -> AUDIO (Valid)
        const isValid = validateConnection(
            nodeA,
            nodeB,
            'track', // Output handle ID
            'media'  // Input handle ID
        );

        expect(isValid).toBe(true);
    });

    it('Scenario: The Structural Failure - rejects incompatible materials', () => {
        // Node A: Music Generator (Output: AUDIO)
        const nodeA = createNode('node-1', 'departmentNode', {
            departmentName: 'Music',
            selectedJobId: 'generate-track'
        });

        // Node B: Marketing (Input: TEXT via 'caption')
        const nodeB = createNode('node-2', 'departmentNode', {
            departmentName: 'Marketing',
            selectedJobId: 'social-post'
        });

        // Connect AUDIO -> TEXT (Invalid)
        const isValid = validateConnection(
            nodeA,
            nodeB,
            'track',   // AUDIO
            'caption'  // TEXT
        );

        expect(isValid).toBe(false);
    });

    it('Scenario: The Universal Adapter - accepts ANY types', () => {
        const nodeA = createNode('node-1', 'inputNode'); // Trigger (ANY or TRIGGER)
        const nodeB = createNode('node-2', 'departmentNode', {
            departmentName: 'Music',
            selectedJobId: 'generate-track'
        });

        // Connect Trigger -> TEXT input (Should be valid if Trigger is ANY or compatible)
        // inputNode source handle type is TRIGGER (if handleId exists) or ANY (if not?)
        // Let's check logic: getHandleType returns TRIGGER if isSource && node.type==='inputNode'
        // validateConnection: ANY matches anything?
        // Wait, line 40: if (sourceType === 'ANY' || targetType === 'ANY') return true;
        // BUT TRIGGER !== ANY.
        // Let's see getHandleType implementation for inputNode: return isSource ? 'TRIGGER' : 'ANY';
        // So Source is TRIGGER. Target is TEXT.
        // TRIGGER !== TEXT.
        // Does 'inputNode' produce 'ANY'? The implementation said 'TRIGGER'.
        // Let's check if 'TRIGGER' connects to 'TEXT'. If not defined, it returns false.

        // Let's test standard "ANY" behavior -> e.g. if we have a node that returns ANY.
        // If handleId is null, getHandleType returns ANY.

        const isValid = validateConnection(
            nodeA,
            nodeB,
            null, // null handle -> ANY
            'style'
        );
        expect(isValid).toBe(true);
    });
});
