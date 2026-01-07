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

vi.mock('@/services/agent/MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn()
    }
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn()
    }
}));

import { MemoryTools } from '../MemoryTools';
import { useStore } from '@/core/store';
import { memoryService } from '../services/agent/MemoryService';
import { AI } from '../services/ai/AIService';

describe('MemoryTools', () => {
    const mockStoreState = {
        currentProjectId: 'project-123',
        agentHistory: [
            { role: 'user', text: 'Hello, how are you?' },
            { role: 'model', text: 'I am doing well, thank you!' },
            { role: 'user', text: 'Can you help me with something?' },
            { role: 'model', text: 'Of course! What do you need help with?' },
            { role: 'user', text: 'I need to generate an image' }
        ]
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (useStore.getState as any).mockReturnValue(mockStoreState);
    });

    describe('save_memory', () => {
        it('should save memory successfully', async () => {
            (memoryService.saveMemory as any).mockResolvedValue(undefined);

            const result = await MemoryTools.save_memory({
                content: 'User prefers dark themes'
            });

            expect(result.success).toBe(true);
            expect(result.data.message).toContain('Memory saved');
            expect(result.data.content).toBe('User prefers dark themes');
            expect(memoryService.saveMemory).toHaveBeenCalledWith(
                'project-123',
                'User prefers dark themes',
                'fact'
            );
        });

        it('should use specified memory type', async () => {
            (memoryService.saveMemory as any).mockResolvedValue(undefined);

            await MemoryTools.save_memory({
                content: 'Always use formal language',
                type: 'rule'
            });

            expect(memoryService.saveMemory).toHaveBeenCalledWith(
                'project-123',
                'Always use formal language',
                'rule'
            );
        });

        it('should handle save errors', async () => {
            (memoryService.saveMemory as any).mockRejectedValue(new Error('Storage full'));

            const result = await MemoryTools.save_memory({
                content: 'Test memory'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Storage full');
        });

        it('should default to fact type', async () => {
            (memoryService.saveMemory as any).mockResolvedValue(undefined);

            await MemoryTools.save_memory({ content: 'Some fact' });

            expect(memoryService.saveMemory).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                'fact'
            );
        });
    });

    describe('recall_memories', () => {
        it('should recall relevant memories', async () => {
            const mockMemories = [
                'User likes blue color',
                'Previous project was about music',
                'Prefers minimal design'
            ];
            (memoryService.retrieveRelevantMemories as any).mockResolvedValue(mockMemories);

            const result = await MemoryTools.recall_memories({ query: 'user preferences' });

            expect(result.success).toBe(true);
            expect(result.data.memories).toEqual(mockMemories);
            expect(result.data.message).toContain('Retrieved 3 relevant memories');

            expect(memoryService.retrieveRelevantMemories).toHaveBeenCalledWith(
                'project-123',
                'user preferences'
            );
        });

        it('should handle no memories found', async () => {
            (memoryService.retrieveRelevantMemories as any).mockResolvedValue([]);

            const result = await MemoryTools.recall_memories({ query: 'obscure topic' });

            expect(result.success).toBe(true);
            expect(result.data.memories).toEqual([]);
            expect(result.data.message).toContain('No relevant memories found');
        });

        it('should handle recall errors', async () => {
            (memoryService.retrieveRelevantMemories as any).mockRejectedValue(
                new Error('Database unavailable')
            );

            const result = await MemoryTools.recall_memories({ query: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Database unavailable');
        });
    });

    describe('read_history', () => {
        it('should return last 5 messages', async () => {
            const result = await MemoryTools.read_history({});

            expect(result.success).toBe(true);
            expect(result.data.history).toHaveLength(5);
            expect(result.data.history[0]).toHaveProperty('role');
            expect(result.data.history[0]).toHaveProperty('text');
        });

        it('should truncate long messages', async () => {
            (useStore.getState as any).mockReturnValue({
                agentHistory: [
                    {
                        role: 'user',
                        text: 'This is a very long message that should be truncated because it exceeds the fifty character limit that we have set'
                    }
                ]
            });

            const result = await MemoryTools.read_history({});

            expect(result.data.history[0].text).toContain('...');
            expect(result.data.history[0].text.length).toBeLessThan(100);
        });

        it('should handle empty history', async () => {
            (useStore.getState as any).mockReturnValue({ agentHistory: [] });

            const result = await MemoryTools.read_history({});

            expect(result.success).toBe(true);
            expect(result.data.history).toHaveLength(0);
        });
    });

    describe('verify_output', () => {
        it('should verify output and return result', async () => {
            const mockVerification = {
                score: 8,
                reason: 'Content meets the goal well',
                pass: true
            };
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify(mockVerification)
            });

            const result = await MemoryTools.verify_output({
                goal: 'Write a compelling headline',
                content: 'Revolutionary AI Changes Everything'
            });

            expect(result.success).toBe(true);
            expect(result.data.verification.score).toBe(8);
            expect(AI.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gemini-3-pro-preview',
                    config: expect.objectContaining({
                        responseMimeType: 'application/json'
                    })
                })
            );
        });

        it('should include goal and content in prompt', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => '{"score": 7, "pass": true}'
            });

            await MemoryTools.verify_output({
                goal: 'Test Goal',
                content: 'Test Content'
            });

            const callArgs = (AI.generateContent as any).mock.calls[0][0];
            const promptText = callArgs.contents[0].parts[0].text;
            expect(promptText).toContain('Test Goal');
            expect(promptText).toContain('Test Content');
        });

        it('should handle verification errors', async () => {
            (AI.generateContent as any).mockRejectedValue(new Error('API unavailable'));

            const result = await MemoryTools.verify_output({
                goal: 'Goal',
                content: 'Content'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('API unavailable');
        });

        it('should handle unknown errors', async () => {
            (AI.generateContent as any).mockRejectedValue('Unknown error type');

            const result = await MemoryTools.verify_output({
                goal: 'Goal',
                content: 'Content'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown error type');
        });
    });
});
