
import { describe, it, expect, vi } from 'vitest';
import { TOOL_REGISTRY } from './tools';
import { alwaysOnMemoryEngine } from './memory/AlwaysOnMemoryEngine';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentProjectId: 'test-project',
            addAgentMessage: vi.fn(),
            updateAgentMessage: vi.fn(),
            userProfile: { brandKit: { colors: [], fonts: [], releaseDetails: {} } },
            projects: [],
            currentOrganizationId: 'org-1',
            requestApproval: vi.fn().mockResolvedValue(true)
        })
    }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({ text: () => 'Mock AI Response' }),
        generateContentStream: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        ingest: vi.fn().mockResolvedValue('Memory processed'),
        query: vi.fn().mockResolvedValue('Retrieved synthesized answer')
    }
}));

describe('indii Conductor Restoration', () => {
    it('should have the new tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('save_memory');
        expect(TOOL_REGISTRY).toHaveProperty('recall_memories');
        expect(TOOL_REGISTRY).toHaveProperty('verify_output');
        expect(TOOL_REGISTRY).toHaveProperty('request_approval');
    });

    it('save_memory tool should call AlwaysOnMemoryEngine', async () => {
        const result = (await TOOL_REGISTRY['save_memory']!({ content: 'Test memory', type: 'fact' })) as any;
        expect(alwaysOnMemoryEngine.ingest).toHaveBeenCalled();
        expect(result.data.message).toContain('Memory stored');
    });

    it('recall_memories tool should call AlwaysOnMemoryEngine', async () => {
        const result = (await TOOL_REGISTRY['recall_memories']!({ query: 'test' })) as any;
        expect(alwaysOnMemoryEngine.query).toHaveBeenCalledWith('test');
        expect(result.data.message).toContain('Retrieved');
    });

    it('request_approval tool should return approved message', async () => {
        const result = (await TOOL_REGISTRY['request_approval']!({ content: 'Post this?' })) as unknown as { data: { message: string } };
        expect(result.data.message).toContain('[APPROVED]');
    });
});
