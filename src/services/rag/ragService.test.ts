/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn(),
        query: vi.fn(),
        createDocument: vi.fn(),
        ingestText: vi.fn()
    }
}));

// Mock AI models config
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: { AGENT: 'gemini-3-pro-preview', FAST: 'gemini-3-pro-preview' }
    },
    AI_CONFIG: {
        THINKING: { LOW: { thinkingConfig: { thinkingLevel: 'LOW' } } }
    }
}));

import { runAgenticWorkflow, processForKnowledgeBase } from './ragService';
import { AI } from '../ai/AIService';
import { GeminiRetrieval } from './GeminiRetrievalService';
import type { UserProfile, AudioAnalysisJob } from '../../modules/workflow/types';

describe('ragService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runAgenticWorkflow', () => {
        const mockUserProfile: UserProfile = {
            id: 'user-123',
            displayName: 'Test User',
            email: 'test@example.com',
            createdAt: Date.now(),
            onboarding: { completed: true }
        };

        const mockAudioTrack: AudioAnalysisJob | null = null;
        const mockOnUpdate = vi.fn();
        const mockUpdateDocStatus = vi.fn();

        it('should initialize corpus and query successfully', async () => {
            const mockCorpusName = 'corpora/test-corpus';
            const mockAnswer = {
                answer: {
                    content: { parts: [{ text: 'This is the answer from RAG.' }] },
                    groundingAttributions: [
                        {
                            sourceId: 'corpora/test-corpus/documents/doc1',
                            content: { parts: [{ text: 'Source passage' }] }
                        }
                    ]
                }
            };

            (GeminiRetrieval.initCorpus as any).mockResolvedValue(mockCorpusName);
            (GeminiRetrieval.query as any).mockResolvedValue(mockAnswer);

            const result = await runAgenticWorkflow(
                'What is the answer?',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result.asset).toBeDefined();
            expect(result.asset.assetType).toBe('knowledge');
            expect(result.asset.content).toBe('This is the answer from RAG.');
            expect(result.asset.sources).toHaveLength(1);
            expect(result.asset.tags).toContain('gemini-rag');
            expect(mockOnUpdate).toHaveBeenCalledWith('Initializing Gemini Knowledge Base...');
            expect(mockOnUpdate).toHaveBeenCalledWith('Querying Semantic Retriever...');
        });

        it('should handle missing answer gracefully', async () => {
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.query as any).mockResolvedValue({
                answer: { content: { parts: [] } }
            });

            const result = await runAgenticWorkflow(
                'Unknown query',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result.asset.content).toBe('No answer found.');
        });

        it('should handle empty grounding attributions', async () => {
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.query as any).mockResolvedValue({
                answer: {
                    content: { parts: [{ text: 'Answer without sources' }] },
                    groundingAttributions: []
                }
            });

            const result = await runAgenticWorkflow(
                'Query',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result.asset.sources).toHaveLength(0);
        });

        it('should throw error if corpus initialization fails', async () => {
            (GeminiRetrieval.initCorpus as any).mockRejectedValue(new Error('Corpus init failed'));

            await expect(
                runAgenticWorkflow(
                    'Query',
                    mockUserProfile,
                    mockAudioTrack,
                    mockOnUpdate,
                    mockUpdateDocStatus
                )
            ).rejects.toThrow('Corpus init failed');
        });

        it('should throw error if query fails', async () => {
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.query as any).mockRejectedValue(new Error('Query failed'));

            await expect(
                runAgenticWorkflow(
                    'Query',
                    mockUserProfile,
                    mockAudioTrack,
                    mockOnUpdate,
                    mockUpdateDocStatus
                )
            ).rejects.toThrow('Query failed');
        });

        it('should include reasoning trace in asset', async () => {
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/my-corpus');
            (GeminiRetrieval.query as any).mockResolvedValue({
                answer: {
                    content: { parts: [{ text: 'Answer' }] },
                    groundingAttributions: []
                }
            });

            const result = await runAgenticWorkflow(
                'Test query',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result.asset.reasoningTrace).toBeDefined();
            expect(result.asset.reasoningTrace).toContain('Query: "Test query"');
            expect(result.asset.reasoningTrace).toContain('Corpus: corpora/my-corpus');
        });

        it('should generate unique ID for each asset', async () => {
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.query as any).mockResolvedValue({
                answer: { content: { parts: [{ text: 'Answer' }] } }
            });

            const result1 = await runAgenticWorkflow(
                'Query 1',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            const result2 = await runAgenticWorkflow(
                'Query 2',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result1.asset.id).not.toBe(result2.asset.id);
        });
    });

    describe('processForKnowledgeBase', () => {
        it('should extract metadata and ingest into corpus', async () => {
            const mockCorpusName = 'corpora/test-corpus';
            const mockDocName = 'corpora/test-corpus/documents/doc123';

            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({
                    title: 'Extracted Title',
                    summary: 'This is the summary.'
                })
            });

            (GeminiRetrieval.initCorpus as any).mockResolvedValue(mockCorpusName);
            (GeminiRetrieval.createDocument as any).mockResolvedValue({ name: mockDocName });
            (GeminiRetrieval.ingestText as any).mockResolvedValue(undefined);

            const result = await processForKnowledgeBase(
                'Raw content to process',
                'document.pdf',
                { size: '1.5 MB', type: 'application/pdf' }
            );

            expect(result.title).toBe('Extracted Title');
            expect(result.content).toBe('This is the summary.');
            expect(result.tags).toContain('gemini-corpus');
            expect(GeminiRetrieval.createDocument).toHaveBeenCalledWith(
                mockCorpusName,
                'Extracted Title',
                expect.objectContaining({
                    source: 'document.pdf',
                    fileSize: '1.5 MB',
                    mimeType: 'application/pdf'
                })
            );
            expect(GeminiRetrieval.ingestText).toHaveBeenCalledWith(
                mockDocName,
                'Raw content to process'
            );
        });

        it('should use fallback title if metadata extraction fails', async () => {
            (AI.generateContent as any).mockRejectedValue(new Error('Extraction failed'));
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.createDocument as any).mockResolvedValue({ name: 'doc' });
            (GeminiRetrieval.ingestText as any).mockResolvedValue(undefined);

            const result = await processForKnowledgeBase(
                'Content',
                'fallback-source.txt'
            );

            expect(result.title).toBe('fallback-source.txt');
        });

        it('should handle corpus ingestion failure gracefully', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({ title: 'Title', summary: 'Summary' })
            });
            (GeminiRetrieval.initCorpus as any).mockRejectedValue(new Error('Corpus error'));

            // Should not throw, just log error
            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.title).toBe('Title');
            expect(result.content).toBe('Summary');
        });

        it('should handle document creation failure gracefully', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({ title: 'Title', summary: 'Summary' })
            });
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.createDocument as any).mockRejectedValue(new Error('Doc creation failed'));

            // Should not throw
            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.title).toBe('Title');
        });

        it('should use default metadata values when not provided', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({ title: 'Title', summary: 'Summary' })
            });
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.createDocument as any).mockResolvedValue({ name: 'doc' });
            (GeminiRetrieval.ingestText as any).mockResolvedValue(undefined);

            await processForKnowledgeBase('Content', 'source.txt');

            expect(GeminiRetrieval.createDocument).toHaveBeenCalledWith(
                'corpora/test',
                'Title',
                expect.objectContaining({
                    fileSize: '0 KB',
                    mimeType: 'text/plain'
                })
            );
        });

        it('should return empty entities array', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({ title: 'Title', summary: 'Summary' })
            });
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.createDocument as any).mockResolvedValue({ name: 'doc' });
            (GeminiRetrieval.ingestText as any).mockResolvedValue(undefined);

            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.entities).toEqual([]);
        });

        it('should set embeddingId to managed placeholder', async () => {
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify({ title: 'Title', summary: 'Summary' })
            });
            (GeminiRetrieval.initCorpus as any).mockResolvedValue('corpora/test');
            (GeminiRetrieval.createDocument as any).mockResolvedValue({ name: 'doc' });
            (GeminiRetrieval.ingestText as any).mockResolvedValue(undefined);

            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.embeddingId).toBe('managed-by-gemini');
        });
    });
});
