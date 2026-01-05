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

vi.mock('@/services/rag/ragService', () => ({
    runAgenticWorkflow: vi.fn()
}));

import { KnowledgeTools } from './KnowledgeTools';
import { useStore } from '@/core/store';
import { runAgenticWorkflow } from '@/services/rag/ragService';

describe('KnowledgeTools', () => {
    const mockUserProfile = {
        id: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com'
    };

    const mockStoreState = {
        userProfile: mockUserProfile
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (useStore.getState as any).mockReturnValue(mockStoreState);
    });

    describe('search_knowledge', () => {
        it('should search knowledge base successfully', async () => {
            const mockAsset = {
                content: 'The answer to your question is 42.',
                sources: [
                    { name: 'Guide.pdf' },
                    { name: 'FAQ.md' }
                ]
            };
            (runAgenticWorkflow as any).mockResolvedValue({ asset: mockAsset });

            const result = await KnowledgeTools.search_knowledge({
                query: 'What is the meaning of life?'
            });

            const data = result.data;
            expect(data.answer).toBe('The answer to your question is 42.');
            expect(data.sources).toHaveLength(2);
            expect(data.sources[0].title).toBe('Guide.pdf');
        });

        it('should pass user profile to workflow', async () => {
            const mockAsset = { content: 'Answer', sources: [] };
            (runAgenticWorkflow as any).mockResolvedValue({ asset: mockAsset });

            await KnowledgeTools.search_knowledge({ query: 'test query' });

            expect(runAgenticWorkflow).toHaveBeenCalledWith(
                'test query',
                mockUserProfile,
                null,
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should handle missing user profile', async () => {
            (useStore.getState as any).mockReturnValue({ userProfile: null });

            const result = await KnowledgeTools.search_knowledge({ query: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('User profile not loaded');
            expect(runAgenticWorkflow).not.toHaveBeenCalled();
        });

        it('should handle workflow errors', async () => {
            (runAgenticWorkflow as any).mockRejectedValue(
                new Error('Knowledge base unavailable')
            );

            const result = await KnowledgeTools.search_knowledge({ query: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Knowledge base unavailable');
        });

        it('should handle empty sources', async () => {
            const mockAsset = {
                content: 'No specific sources found.',
                sources: []
            };
            (runAgenticWorkflow as any).mockResolvedValue({ asset: mockAsset });

            const result = await KnowledgeTools.search_knowledge({ query: 'obscure topic' });

            const data = result.data;
            expect(data.answer).toBe('No specific sources found.');
            expect(data.sources).toHaveLength(0);
        });

        it('should map source names to titles', async () => {
            const mockAsset = {
                content: 'Answer',
                sources: [
                    { name: 'Document 1.pdf', content: 'Some content' },
                    { name: 'Document 2.md', content: 'Other content' }
                ]
            };
            (runAgenticWorkflow as any).mockResolvedValue({ asset: mockAsset });

            const result = await KnowledgeTools.search_knowledge({ query: 'test' });

            const data = result.data;
            expect(data.sources[0].title).toBe('Document 1.pdf');
            expect(data.sources[1].title).toBe('Document 2.md');
        });

        it('should log progress updates', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => { });

            const mockAsset = { content: 'Answer', sources: [] };
            (runAgenticWorkflow as any).mockImplementation(
                async (query: any, profile: any, track: any, onUpdate: any) => {
                    onUpdate('Searching...');
                    onUpdate('Processing results...');
                    return { asset: mockAsset };
                }
            );

            await KnowledgeTools.search_knowledge({ query: 'test' });

            expect(consoleSpy).toHaveBeenCalledWith('[RAG] Searching...');
            expect(consoleSpy).toHaveBeenCalledWith('[RAG] Processing results...');

            consoleSpy.mockRestore();
        });

        it('should handle non-Error exceptions', async () => {
            (runAgenticWorkflow as any).mockRejectedValue('String error');

            const result = await KnowledgeTools.search_knowledge({ query: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('String error');
        });
    });
});
