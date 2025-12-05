
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memoryService } from './MemoryService';
import { firestoreService } from '../FirestoreService';

// Mock FirestoreService
vi.mock('../FirestoreService', () => ({
    firestoreService: {
        add: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        update: vi.fn()
    }
}));

// Mock AIService - embedContent returns empty to use keyword fallback in tests
vi.mock('../ai/AIService', () => ({
    AI: {
        embedContent: vi.fn().mockResolvedValue({ embedding: { values: [] } })
    }
}));

describe('MemoryService Tests', () => {
    const projectId = 'proj_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveMemory', () => {
        it('should add memory to firestore if not duplicate', async () => {
            // Mock list to return empty, so it's not a duplicate
            (firestoreService.list as any).mockResolvedValue([]);

            await memoryService.saveMemory(projectId, 'The sky is blue', 'fact');

            expect(firestoreService.add).toHaveBeenCalledWith(
                `projects/${projectId}/memories`,
                expect.objectContaining({
                    projectId,
                    content: 'The sky is blue',
                    type: 'fact'
                })
            );
        });

        it('should NOT add memory if duplicate exists', async () => {
            // Mock list to return existing memory
            (firestoreService.list as any).mockResolvedValue([
                { id: '1', content: 'The sky is blue', projectId, type: 'fact', timestamp: 123 }
            ]);

            await memoryService.saveMemory(projectId, 'The sky is blue', 'fact');

            expect(firestoreService.add).not.toHaveBeenCalled();
        });
    });

    describe('retrieveRelevantMemories', () => {
        it('should filter memories by keyword', async () => {
            const mockMemories = [
                { id: '1', content: 'The sky is blue', projectId, type: 'fact', timestamp: 1 },
                { id: '2', content: 'Grass is green', projectId, type: 'fact', timestamp: 2 },
                { id: '3', content: 'Water is blue', projectId, type: 'fact', timestamp: 3 }
            ];
            (firestoreService.list as any).mockResolvedValue(mockMemories);

            const results = await memoryService.retrieveRelevantMemories(projectId, 'blue sky');

            expect(results).toHaveLength(2);
            expect(results).toContain('The sky is blue');
            expect(results).toContain('Water is blue');
            expect(results).not.toContain('Grass is green');
        });

        it('should boost rule memories', async () => {
            const mockMemories = [
                { id: '1', content: 'Always check the weather', projectId, type: 'rule', timestamp: 1 },
                { id: '2', content: 'Weather is nice', projectId, type: 'fact', timestamp: 2 }
            ];
            (firestoreService.list as any).mockResolvedValue(mockMemories);

            // Searching for "weather"
            // Both contain "weather".
            // Rule should get boosted score (1 + 0.5 = 1.5) vs Fact (1).
            // Sort order should be Rule first.
            const results = await memoryService.retrieveRelevantMemories(projectId, 'weather');

            expect(results[0]).toBe('Always check the weather');
        });
    });

    describe('clearProjectMemory', () => {
        it('should delete all memories for project', async () => {
            const mockMemories = [
                { id: 'm1', content: 'A', projectId },
                { id: 'm2', content: 'B', projectId }
            ];
            (firestoreService.list as any).mockResolvedValue(mockMemories);

            await memoryService.clearProjectMemory(projectId);

            expect(firestoreService.delete).toHaveBeenCalledTimes(2);
            expect(firestoreService.delete).toHaveBeenCalledWith(`projects/${projectId}/memories`, 'm1');
            expect(firestoreService.delete).toHaveBeenCalledWith(`projects/${projectId}/memories`, 'm2');
        });
    });
});
