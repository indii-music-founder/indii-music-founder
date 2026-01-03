
import { describe, it, expect, vi } from 'vitest';
import { TOOL_REGISTRY } from './tools';
import { memoryService } from './MemoryService';

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

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({ text: () => 'Mock AI Response' }),
        generateContentStream: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn().mockResolvedValue(['Memory 1', 'Memory 2'])
    }
}));

describe('Agent Zero Restoration', () => {
    it('should have the new tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('save_memory');
        expect(TOOL_REGISTRY).toHaveProperty('recall_memories');
        expect(TOOL_REGISTRY).toHaveProperty('verify_output');
        expect(TOOL_REGISTRY).toHaveProperty('request_approval');
    });

    it('save_memory tool should call MemoryService', async () => {
        const result = await TOOL_REGISTRY['save_memory']({ content: 'Test memory' });
        expect(memoryService.saveMemory).toHaveBeenCalledWith('test-project', 'Test memory', 'fact');
        expect(result).toContain('Memory saved');
    });

    it('recall_memories tool should call MemoryService', async () => {
        const result = await TOOL_REGISTRY['recall_memories']({ query: 'test' });
        expect(memoryService.retrieveRelevantMemories).toHaveBeenCalledWith('test-project', 'test');
        expect(result).toContain('Relevant Memories');
    });

    it('request_approval tool should return approved message', async () => {
        const result = await TOOL_REGISTRY['request_approval']({ content: 'Post this?' });
        expect(result).toContain('[APPROVED]');
    });
});
