
import { describe, it, expect, vi } from 'vitest';
import { TOOL_REGISTRY } from './tools';
import { alwaysOnMemoryEngine } from './memory/AlwaysOnMemoryEngine';
import type { ToolFunctionResult } from './types';

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

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn().mockResolvedValue({ text: () => 'Mock Autonomous Response' }),
        generateContentStream: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        ingestWithReceipt: vi.fn().mockResolvedValue({ status: 'stored', memoryId: 'registry-memory', summary: 'Memory processed' }),
        queryFromServer: vi.fn().mockResolvedValue('Retrieved synthesized answer')
    }
}));

describe('indii Conductor Restoration', () => {
    it('should have the new tools registered', () => {
        expect(TOOL_REGISTRY).toHaveProperty('save_memory');
        expect(TOOL_REGISTRY).toHaveProperty('recall_memories');
        expect(TOOL_REGISTRY).toHaveProperty('verify_output');
        expect(TOOL_REGISTRY).toHaveProperty('request_approval');
    });

    it('save_memory registry entry preserves the acknowledged memory receipt', async () => {
        const result = await TOOL_REGISTRY.save_memory!({ content: 'Test memory', type: 'fact' }) as ToolFunctionResult;
        expect(alwaysOnMemoryEngine.ingestWithReceipt).toHaveBeenCalledWith('Test memory', 'agent_extraction', 'fact');
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ status: 'stored', memoryId: 'registry-memory' });
        expect(result.message).toContain('Reference: registry-memory');
    });

    it('save_memory registry entry does not convert an uncertain write to success', async () => {
        vi.mocked(alwaysOnMemoryEngine.ingestWithReceipt).mockResolvedValueOnce({ status: 'unconfirmed', reason: 'response lost' });
        const result = await TOOL_REGISTRY.save_memory!({ content: 'Test memory' }) as ToolFunctionResult;
        expect(result.success).toBe(false);
        expect(result.metadata).toMatchObject({ errorCode: 'MEMORY_SAVE_UNCONFIRMED', retryable: false });
    });

    it('recall_memories tool should call AlwaysOnMemoryEngine', async () => {
        const result = (await TOOL_REGISTRY['recall_memories']!({ query: 'test' })) as any;
        expect(alwaysOnMemoryEngine.queryFromServer).toHaveBeenCalledWith('test');
        expect(result.data.message).toContain('Retrieved');
    });

    it('request_approval tool should return approved message', async () => {
        const result = (await TOOL_REGISTRY['request_approval']!({ content: 'Post this?' })) as unknown as { data: { message: string } };
        expect(result.data.message).toContain('[APPROVED]');
    });
});
