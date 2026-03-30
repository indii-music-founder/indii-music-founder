import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeTools } from '../KnowledgeTools';
import { runAgenticWorkflow } from '@/services/rag/ragService';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/services/rag/ragService', () => ({
    runAgenticWorkflow: vi.fn()
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

// Mock console methods to avoid cluttering test output
const consoleMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};
global.console = { ...global.console, ...consoleMock };

describe('KnowledgeTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('search_knowledge', () => {
        it('should error if user is not logged in', async () => {
            vi.mocked(useStore.getState).mockReturnValue({ userProfile: null } as unknown as ReturnType<typeof useStore.getState>);

            const result = await KnowledgeTools.search_knowledge({ query: 'test query' });

            expect(result.success).toBe(false);
            expect(result.error).toBe("User profile not loaded. Please log in.");
            expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
        });

        it('should run agentic workflow and return structured data when logged in', async () => {
            vi.mocked(useStore.getState).mockReturnValue({ userProfile: { id: 'test-user' } } as unknown as ReturnType<typeof useStore.getState>);

            const mockAsset = {
                assetType: 'knowledge' as const,
                content: 'Test answer',
                sources: [
                    { name: 'Source 1', content: 'c1' },
                    { name: 'Source 2', content: 'c2' }
                ]
            };

            vi.mocked(runAgenticWorkflow).mockResolvedValue({
                asset: mockAsset,
                updatedProfile: null
            });

            const result = await KnowledgeTools.search_knowledge({ query: 'test query' });

            expect(runAgenticWorkflow).toHaveBeenCalledWith(
                'test query',
                { id: 'test-user' },
                null,
                expect.any(Function),
                expect.any(Function)
            );

            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                answer: 'Test answer',
                sources: [
                    { title: 'Source 1' },
                    { title: 'Source 2' }
                ],
                message: 'Knowledge search completed successfully.'
            });
        });
    });
});
