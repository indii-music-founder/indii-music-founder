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

vi.mock('../../registry', () => ({
    agentRegistry: {
        get: vi.fn(),
        getAsync: vi.fn(),
        listCapabilities: vi.fn()
    }
}));

import { CoreTools } from '../CoreTools';
import { useStore } from '@/core/store';
import { agentRegistry } from '../../registry';
import { AI_MODELS } from '@/core/config/ai-models';
import { GenAI as AI } from '@/services/ai/GenAI';

const { mockAI } = vi.hoisted(() => ({
    mockAI: {
        rawGenerateContent: vi.fn(),
        generateStructuredData: vi.fn().mockResolvedValue({
            score: 8,
            reason: "Good",
            pass: true
        }),
        analyzeImage: vi.fn().mockResolvedValue('Mock analysis')
    }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: mockAI
}));

describe('CoreTools', () => {
    const mockStoreState = {
        currentOrganizationId: 'org-123',
        currentProjectId: 'project-123',
        setModule: vi.fn(),
        requestApproval: vi.fn(),
        setAgentMode: vi.fn(),
        agentMode: 'assistant',
        agentHistory: [
            { role: 'user', text: 'Hello' },
            { role: 'model', text: 'Hi there' }
        ]
    };

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(useStore.getState).mockReturnValue(mockStoreState as unknown as ReturnType<typeof useStore.getState>);
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

    describe('read_history', () => {
        it('should return history items', async () => {
            const result = await CoreTools.read_history({});
            expect(result.success).toBe(true);
            expect(result.data.history).toHaveLength(2);
            expect(result.data.history[0].text).toBe('Hello');
        });

        it('should truncate long messages', async () => {
            mockStoreState.agentHistory = [{
                role: 'user',
                text: 'a'.repeat(200)
            }];
            const result = await CoreTools.read_history({});
            expect(result.data.history[0].text.length).toBe(100);
        });
    });

    describe('verify_output', () => {
        it('should verify content meet goal', async () => {
            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                score: 8,
                reason: "Good",
                pass: true
            });

            const result = await CoreTools.verify_output({
                goal: 'Test goal',
                content: 'Test content'
            });
            expect(result.success).toBe(true);
            expect(AI.generateStructuredData).toHaveBeenCalled();
            expect(result.data.verification.pass).toBe(true);
        });
    });
});
