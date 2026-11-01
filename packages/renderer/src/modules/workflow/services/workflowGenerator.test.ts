import { describe, it, expect, vi } from 'vitest';
import { generateWorkflowFromPrompt } from './workflowGenerator';
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({ AutonomousIntelligence: { generateStructuredData: generate } }));
describe('workflow architect response validation', () => {
    it('rejects an empty provider result with a useful error', async () => {
        generate.mockResolvedValueOnce(undefined);
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('incomplete graph');
    });
    it('rejects edges to nonexistent nodes', async () => {
        generate.mockResolvedValueOnce({ nodes: [{ id: 'start', type: 'inputNode', position: { x: 0, y: 0 }, data: { nodeType: 'input' } }], edges: [{ id: 'bad', source: 'start', target: 'missing' }] });
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('disconnected reference');
    });
    it('rejects invented department jobs', async () => {
        generate.mockResolvedValueOnce({ nodes: [{ id: 'art', type: 'departmentNode', position: { x: 0, y: 0 }, data: { nodeType: 'department', departmentName: 'Imaginary', selectedJobId: 'fake' } }], edges: [] });
        await expect(generateWorkflowFromPrompt('Create cover art')).rejects.toThrow('unavailable job');
    });
});
