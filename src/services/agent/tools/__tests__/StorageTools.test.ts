import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageTools } from '../StorageTools';
import { StorageService } from '@/services/StorageService';

// Mock dependencies
vi.mock('@/services/StorageService', () => ({
    StorageService: {
        loadHistory: vi.fn()
    }
}));

describe('StorageTools', () => {
    const mockHistoryItems = [
        { id: '1', type: 'image', prompt: 'A sunset over the ocean', url: 'http://img1.com', timestamp: 1000 },
        { id: '2', type: 'video', prompt: 'A cyberpunk city', url: 'http://vid1.com', timestamp: 2000 },
        { id: '3', type: 'audio', prompt: 'Jazz piano solo', url: 'http://aud1.com', timestamp: 3000 },
        { id: '4', type: 'image', prompt: 'A mountain peak', url: 'http://img2.com', timestamp: 4000 },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementation
        (StorageService.loadHistory as any).mockResolvedValue(mockHistoryItems);
    });

    describe('list_files', () => {
        it('should list all files when no type is specified', async () => {
            const args = { limit: 10 };
            const result = await StorageTools.list_files(args);

            expect(StorageService.loadHistory).toHaveBeenCalledWith(10);
            expect(result.success).toBe(true);
            expect(result.data.files).toHaveLength(4);
            expect(result.data.count).toBe(4);
            expect(result.data.message).toContain('Found 4 files');
        });

        it('should filter files by type', async () => {
            const args = { limit: 10, type: 'image' };
            const result = await StorageTools.list_files(args);

            expect(StorageService.loadHistory).toHaveBeenCalledWith(10);
            expect(result.success).toBe(true);
            expect(result.data.files).toHaveLength(2);
            expect(result.data.files.every((f: any) => f.type === 'image')).toBe(true);
            expect(result.data.count).toBe(2);
        });

        it('should return empty list if type matches nothing', async () => {
            const args = { limit: 10, type: 'document' };
            const result = await StorageTools.list_files(args);

            expect(result.success).toBe(true);
            expect(result.data.files).toHaveLength(0);
            expect(result.data.count).toBe(0);
            expect(result.data.message).toBe('No files found.');
        });

        it('should use default limit if not specified', async () => {
            const args = {};
            await StorageTools.list_files(args);
            expect(StorageService.loadHistory).toHaveBeenCalledWith(20);
        });
    });

    describe('search_files', () => {
        it('should return files matching the query in prompt', async () => {
            const args = { query: 'sunset' };
            const result = await StorageTools.search_files(args);

            expect(StorageService.loadHistory).toHaveBeenCalledWith(100);
            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].prompt).toContain('sunset');
        });

        it('should be case-insensitive', async () => {
            const args = { query: 'CYBERPUNK' };
            const result = await StorageTools.search_files(args);

            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].prompt).toContain('cyberpunk');
        });

        it('should return files matching the query in type', async () => {
            const args = { query: 'audio' };
            const result = await StorageTools.search_files(args);

            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(1);
            expect(result.data.results[0].type).toBe('audio');
        });

        it('should return empty list if no matches found', async () => {
            const args = { query: 'unicorn' };
            const result = await StorageTools.search_files(args);

            expect(result.success).toBe(true);
            expect(result.data.results).toHaveLength(0);
            expect(result.data.message).toContain('No files found matching query "unicorn"');
        });

        it('should handle service errors gracefully', async () => {
            (StorageService.loadHistory as any).mockRejectedValue(new Error('Database error'));

            const args = { query: 'test' };
            const result = await StorageTools.search_files(args);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
            expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });
});
