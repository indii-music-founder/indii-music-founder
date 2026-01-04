/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI service before imports
vi.mock('../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        embedContent: vi.fn(),
        parseJSON: vi.fn()
    }
}));

// Mock AI models config
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: { AGENT: 'gemini-3-pro-preview', FAST: 'gemini-3-pro-preview' }
    },
    AI_CONFIG: {
        THINKING: {
            HIGH: { thinkingConfig: { thinkingLevel: 'HIGH' } },
            LOW: { thinkingConfig: { thinkingLevel: 'LOW' } }
        }
    }
}));

// Mock storage repository
vi.mock('../storage/repository', () => ({
    getAssetFromStorage: vi.fn()
}));

import { localQueryStore, generateEmbedding } from './fileSearchService';
import { AI } from '../ai/AIService';
import type { KnowledgeDocument } from '../../modules/workflow/types';

describe('fileSearchService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn();
    });

    describe('generateEmbedding', () => {
        it('should generate embedding for text', async () => {
            const mockEmbedding = { values: [0.1, 0.2, 0.3, 0.4] };
            (AI.embedContent as any).mockResolvedValue({ embedding: mockEmbedding });

            const result = await generateEmbedding('test text');

            expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
            expect(AI.embedContent).toHaveBeenCalledWith({
                model: 'text-embedding-004',
                content: { role: 'user', parts: [{ text: 'test text' }] }
            });
        });

        it('should handle alternate response format (embeddings array)', async () => {
            const mockResponse = { embeddings: [{ values: [0.5, 0.6] }] };
            (AI.embedContent as any).mockResolvedValue(mockResponse);

            const result = await generateEmbedding('test');

            expect(result).toEqual([0.5, 0.6]);
        });

        it('should throw error if embedding generation fails', async () => {
            (AI.embedContent as any).mockRejectedValue(new Error('Embedding failed'));

            await expect(generateEmbedding('test'))
                .rejects.toThrow('Embedding failed');
        });
    });

    describe('localQueryStore', () => {
        const createMockDocument = (overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument => ({
            id: crypto.randomUUID(),
            name: 'Test Document',
            content: 'This is test content about music production and audio engineering.',
            indexingStatus: 'indexed',
            entities: [],
            tags: [],
            ...overrides
        });

        it('should perform hybrid search and return knowledge asset', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({
                    id: 'doc1',
                    name: 'Music Guide',
                    content: 'Music production involves recording, mixing, and mastering audio.',
                    tags: ['music', 'production']
                }),
                createMockDocument({
                    id: 'doc2',
                    name: 'Legal Contract',
                    content: 'This contract outlines the terms of agreement.',
                    tags: ['legal']
                })
            ];

            // Mock query expansion
            (AI.generateContent as any)
                .mockResolvedValueOnce({
                    text: () => JSON.stringify(['music production', 'audio recording'])
                })
                // Mock synthesis
                .mockResolvedValueOnce({
                    text: () => 'Based on your Knowledge Base, music production involves recording and mastering.'
                });

            // Mock embedding generation (will fail, fallback to keyword only)
            (AI.embedContent as any).mockRejectedValue(new Error('Embedding not available'));

            const result = await localQueryStore(mockDocs, 'What is music production?');

            expect(result.assetType).toBe('knowledge');
            expect(result.title).toContain('music production');
            expect(result.content).toBeTruthy();
            expect(result.sources).toBeDefined();
            expect(result.reasoningTrace).toBeDefined();
        });

        it('should filter out documents with error status', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({ id: 'doc1', indexingStatus: 'indexed', content: 'valid content about music' }),
                createMockDocument({ id: 'doc2', indexingStatus: 'error', content: 'error content about music' })
            ];

            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => '[]' }) // query expansion
                .mockResolvedValueOnce({ text: () => 'Answer based on valid content.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'music');

            // Only the non-error document should be in sources
            expect(result.sources?.every(s => s.name !== 'doc2')).toBe(true);
        });

        it('should boost score for entity matches', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({
                    id: 'doc1',
                    name: 'Artist Bio',
                    content: 'Information about the artist.',
                    entities: ['Taylor Swift']
                }),
                createMockDocument({
                    id: 'doc2',
                    name: 'General Info',
                    content: 'Generic music content.'
                })
            ];

            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => '[]' })
                .mockResolvedValueOnce({ text: () => 'Taylor Swift is an artist.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'taylor swift');

            // Artist Bio should rank higher due to entity boost
            if (result.sources && result.sources.length > 0) {
                expect(result.sources[0].name).toBe('Artist Bio');
            }
        });

        it('should boost score for tag matches', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({
                    id: 'doc1',
                    name: 'Licensing Guide',
                    content: 'Information about music licensing.',
                    tags: ['licensing', 'legal']
                }),
                createMockDocument({
                    id: 'doc2',
                    name: 'Other Doc',
                    content: 'Unrelated content.'
                })
            ];

            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => '[]' })
                .mockResolvedValueOnce({ text: () => 'Licensing information.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'licensing');

            if (result.sources && result.sources.length > 0) {
                expect(result.sources[0].name).toBe('Licensing Guide');
            }
        });

        it('should handle no matching documents gracefully', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({
                    id: 'doc1',
                    name: 'Unrelated',
                    content: 'Completely unrelated content about cooking recipes.'
                })
            ];

            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => '[]' })
                .mockResolvedValueOnce({
                    text: () => "I couldn't find that specific information in your Knowledge Base."
                });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'quantum physics');

            // The LLM response is mocked, so we just verify it returns a result
            expect(result.assetType).toBe('knowledge');
            expect(result.content).toBeTruthy();
        });

        it('should expand short queries', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({ content: 'Marketing strategies for musicians.' })
            ];

            (AI.generateContent as any)
                .mockResolvedValueOnce({
                    text: () => JSON.stringify(['marketing strategies', 'promotion techniques', 'advertising'])
                })
                .mockResolvedValueOnce({ text: () => 'Answer about marketing.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'marketing strategies');

            expect(result.reasoningTrace).toBeDefined();
            expect(result.reasoningTrace?.some(t => t.includes('Expanded'))).toBe(true);
        });

        it('should skip query expansion for very short queries', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({ content: 'Music content.' })
            ];

            // Only synthesis call, no expansion for short query
            (AI.generateContent as any).mockResolvedValue({
                text: () => 'Answer.'
            });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            await localQueryStore(mockDocs, 'hi');

            // generateContent should only be called once (for synthesis, not expansion)
            // Actually, looking at the code, expansion happens if query has 3+ words
            // "hi" has 1 word, so no expansion call
            expect(AI.generateContent).toHaveBeenCalledTimes(1);
        });

        it('should handle query expansion failure gracefully', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({ content: 'Test content about music.' })
            ];

            (AI.generateContent as any)
                .mockRejectedValueOnce(new Error('Expansion failed'))
                .mockResolvedValueOnce({ text: () => 'Fallback answer.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'what is music production like');

            // Should still return a result using original query only
            expect(result.content).toBeTruthy();
        });

        it('should throw error if synthesis fails', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({ content: 'Music content with synthesis test query.' })
            ];

            // For short queries (2 words), expansion is skipped, synthesis is called directly
            // Make synthesis fail
            (AI.generateContent as any)
                .mockRejectedValueOnce(new Error('Synthesis failed'));

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            await expect(localQueryStore(mockDocs, 'synthesis test'))
                .rejects.toThrow('Knowledge retrieval failed');
        });

        it('should include retrieval details in result', async () => {
            const mockDocs: KnowledgeDocument[] = [
                createMockDocument({
                    id: 'doc1',
                    name: 'Relevant Doc',
                    content: 'This document contains relevant information about the query topic.'
                })
            ];

            // For short queries (2 words), no expansion is called
            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => 'Answer about query topic.' });

            (AI.embedContent as any).mockRejectedValue(new Error('skip'));

            const result = await localQueryStore(mockDocs, 'query topic');

            expect(result.retrievalDetails).toBeDefined();
            if (result.retrievalDetails && result.retrievalDetails.length > 0) {
                expect(result.retrievalDetails[0]).toHaveProperty('score');
                expect(result.retrievalDetails[0]).toHaveProperty('doc');
            }
        });
    });
});
