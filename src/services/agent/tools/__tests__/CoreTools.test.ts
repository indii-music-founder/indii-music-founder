/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('../registry', () => ({
    agentRegistry: {
        get: vi.fn(),
        getAsync: vi.fn(),
        listCapabilities: vi.fn()
    }
}));

import { CoreTools } from '../CoreTools';
import { useStore } from '@/core/store';
import { agentRegistry } from '../registry';

describe('CoreTools', () => {
    const mockStoreState = {
        currentOrganizationId: 'org-123',
        currentProjectId: 'project-123',
        setModule: vi.fn(),
        requestApproval: vi.fn(),
        setAgentMode: vi.fn(),
        agentMode: 'assistant'
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (useStore.getState as any).mockReturnValue(mockStoreState);
    });

    describe('delegate_task', () => {
        it('should delegate task to valid agent', async () => {
            const mockAgent = {
                name: 'Legal Agent',
                execute: vi.fn().mockResolvedValue({ text: 'Task completed', toolCalls: [] })
            };
            (agentRegistry.getAsync as any).mockResolvedValue(mockAgent);
            (agentRegistry.get as any).mockReturnValue(mockAgent);

            const result = await CoreTools.delegate_task({
                agent_id: 'legal',
                task: 'Review contract'
            });

            expect(result.success).toBe(true);
            expect(result.data.text).toBe('Task completed');
            expect(result.data.message).toContain('[Legal Agent]: Task completed');
            expect(mockAgent.execute).toHaveBeenCalledWith('Review contract', expect.anything());
        });

        it('should handle unknown agent', async () => {
            (agentRegistry.getAsync as any).mockResolvedValue(undefined);
            (agentRegistry.get as any).mockReturnValue(undefined);
            (agentRegistry.listCapabilities as any).mockReturnValue('- legal\n- marketing');

            const result = await CoreTools.delegate_task({
                agent_id: 'unknown' as any,
                task: 'Task'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("not found");
        });
    });

    describe('request_approval', () => {
        it('should handle approved request', async () => {
            mockStoreState.requestApproval.mockResolvedValue(true);

            const result = await CoreTools.request_approval({
                content: 'Post this tweet'
            });

            expect(result.success).toBe(true);
            expect(result.data.approved).toBe(true);
            expect(result.data.message).toContain('[APPROVED]');
        });

        it('should handle rejected request', async () => {
            mockStoreState.requestApproval.mockResolvedValue(false);

            const result = await CoreTools.request_approval({
                content: 'Dangerous action'
            });

            expect(result.success).toBe(true);
            expect(result.data.approved).toBe(false);
            expect(result.data.message).toContain('[REJECTED]');
        });
    });

    describe('set_mode', () => {
        it('should switch to valid mode', async () => {
            const result = await CoreTools.set_mode({ mode: 'creative' });

            expect(result.success).toBe(true);
            expect(result.data.newMode).toBe('creative');
            expect(mockStoreState.setAgentMode).toHaveBeenCalledWith('creative');
        });

        it('should reject invalid mode', async () => {
            const result = await CoreTools.set_mode({ mode: 'invalid' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid mode');
        });
    });

    describe('update_prompt', () => {
        it('should return updated text', async () => {
            const result = await CoreTools.update_prompt({ text: 'New prompt' });

            expect(result.success).toBe(true);
            expect(result.data.text).toBe('New prompt');
            expect(result.data.message).toContain('Prompt updated');
        });
    });
});
