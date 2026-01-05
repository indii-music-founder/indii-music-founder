
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Note: We need to import the class to mock it, and the instance to test it.
// The instance uses the class internally.
import { memoryService, MemoryItem } from './MemoryService';
import { FirestoreService } from '../FirestoreService';
import { AI } from '../ai/AIService';

// Mock dependencies
vi.mock('../FirestoreService');
vi.mock('../ai/AIService');

describe('MemoryService', () => {
    let mockList: any;
    let mockAdd: any;
    let mockUpdate: any;
    let mockDelete: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup FirestoreService mock functions
        mockList = vi.fn().mockResolvedValue([]);
        mockAdd = vi.fn().mockResolvedValue('new-id');
        mockUpdate = vi.fn().mockResolvedValue(undefined);
        mockDelete = vi.fn().mockResolvedValue(undefined);

        // Mock the FirestoreService implementation
        (FirestoreService as any).mockImplementation(function () {
            return {
                list: mockList,
                add: mockAdd,
                update: mockUpdate,
                delete: mockDelete,
                collectionPath: 'projects/test-project/memories'
            };
        });

        // Mock AI embedding
        (AI.embedContent as any).mockResolvedValue({ values: [0.1, 0.2, 0.3] });
    });

    describe('saveMemory', () => {
        it('should save a memory with default values', async () => {
            await memoryService.saveMemory('test-project', 'test content');

            expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
                projectId: 'test-project',
                content: 'test content',
                type: 'fact',
                importance: 0.5,
                accessCount: 0,
                embedding: [0.1, 0.2, 0.3]
            }));
        });

        it('should save a memory with custom importance and source', async () => {
            await memoryService.saveMemory('test-project', 'important rule', 'rule', 0.9, 'system');

            expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
                content: 'important rule',
                type: 'rule',
                importance: 0.9,
                source: 'system'
            }));
        });

        it('should not save duplicate content', async () => {
            mockList.mockResolvedValue([{ content: 'duplicate' }]);
            await memoryService.saveMemory('test-project', 'duplicate');
            expect(mockAdd).not.toHaveBeenCalled();
        });
    });

    describe('retrieveRelevantMemories', () => {
        const mockMemories: MemoryItem[] = [
            {
                id: '1',
                projectId: 'p1',
                content: 'recent important',
                type: 'fact',
                importance: 0.9,
                timestamp: Date.now(), // 0 days old
                accessCount: 0,
                lastAccessed: Date.now(),
                source: 'user',
                embedding: [0.1, 0.2, 0.3]
            },
            {
                id: '2',
                projectId: 'p1',
                content: 'old important',
                type: 'fact',
                importance: 0.9,
                timestamp: Date.now() - (1000 * 60 * 60 * 24 * 30), // 30 days old
                accessCount: 0,
                lastAccessed: Date.now(),
                source: 'user',
                embedding: [0.1, 0.2, 0.3]
            },
            {
                id: '3',
                projectId: 'p1',
                content: 'recent trivial',
                type: 'fact',
                importance: 0.1,
                timestamp: Date.now(),
                accessCount: 0,
                lastAccessed: Date.now(),
                source: 'user',
                embedding: [0.1, 0.2, 0.3]
            }
        ];

        it('should rank recent high-importance memories highest', async () => {
            mockList.mockResolvedValue(mockMemories);
            // Mock query embedding to match (perfect similarity)
            (AI.embedContent as any).mockResolvedValue({ values: [0.1, 0.2, 0.3] });

            const results = await memoryService.retrieveRelevantMemories('p1', 'query', 3);

            // Expected order: 
            // 1. recent important (high sim, high imp, high recency)
            // 2. old important (high sim, high imp, low recency)
            // 3. recent trivial (high sim, low imp, high recency)

            expect(results[0]).toBe('recent important');
            expect(results[1]).toBe('old important');
            expect(results[2]).toBe('recent trivial');
        });

        it('should update access stats for retrieved items', async () => {
            mockList.mockResolvedValue([mockMemories[0]]);
            await memoryService.retrieveRelevantMemories('p1', 'query', 1);

            // Wait a tick for async fire-and-forget
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
                accessCount: 1
            }));
        });

        it('should filter memories by type', async () => {
            mockList.mockResolvedValue(mockMemories);
            // Must return embedding or fallback to keywords. Mock embedding to ensure vector path is taken but irrelevant for filter test.
            (AI.embedContent as any).mockResolvedValue({ values: [0.1, 0.2, 0.3] });

            const results = await memoryService.retrieveRelevantMemories('p1', {
                query: 'query',
                filters: { types: ['rule'] }
            });

            // Should only find rules? 
            // In my mock data, none are explicitly rules in the 'type' field except I should probably update mock data or add one.
            // Let's add a temporary mock item.
            const RuleMemory: MemoryItem = {
                ...mockMemories[0], id: 'rule-1', type: 'rule', content: 'Always do X'
            };
            mockList.mockResolvedValue([...mockMemories, RuleMemory]);

            const results2 = await memoryService.retrieveRelevantMemories('p1', {
                query: 'query',
                filters: { types: ['rule'] }
            });

            expect(results2).toHaveLength(1);
            expect(results2[0]).toBe('Always do X');
        });

        it('should filter memories by date range', async () => {
            const oldItem = { ...mockMemories[1], timestamp: 1000 };
            const newItem = { ...mockMemories[0], timestamp: 2000 };
            mockList.mockResolvedValue([oldItem, newItem]);
            (AI.embedContent as any).mockResolvedValue({ values: [0.1, 0.2, 0.3] });

            const results = await memoryService.retrieveRelevantMemories('p1', {
                query: 'query',
                filters: { dateRange: [1500, 3000] }
            });

            expect(results).toHaveLength(1);
            expect(results[0]).toBe(newItem.content);
        });
    });

    describe('consolidateMemories', () => {
        it('should consolidate memories using AI', async () => {
            const oldMemories = Array(10).fill(0).map((_, i) => ({
                id: `old-${i}`,
                projectId: 'p1',
                content: `fact ${i}`,
                type: 'fact',
                timestamp: Date.now() - (1000 * 60 * 60 * 48), // 48 hours old
            }));

            mockList.mockResolvedValue(oldMemories);

            // Mock AI response
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({
                    consolidated: ['Summary of facts'],
                    idsToDelete: ['old-0', 'old-1']
                })
            });

            await memoryService.consolidateMemories('p1');

            // Check if AI was called
            expect(AI.generateContent).toHaveBeenCalled();

            // Check if old memories were deleted
            expect(mockDelete).toHaveBeenCalledWith('old-0');
            expect(mockDelete).toHaveBeenCalledWith('old-1');

            // Check if new summary was saved
            // saveMemory calls getService().add()
            expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
                content: 'Summary of facts',
                type: 'summary',
                importance: 0.8
            }));
        });

        it('should ignore recent memories', async () => {
            const recentMemories = [{
                id: 'new-1',
                projectId: 'p1',
                content: 'fact new',
                type: 'fact',
                timestamp: Date.now()
            }];

            mockList.mockResolvedValue(recentMemories);

            await memoryService.consolidateMemories('p1');

            // Should not call AI
            expect(AI.generateContent).not.toHaveBeenCalled();
        });
    });
});
