/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('./GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn(),
        query: vi.fn(),
        createDocument: vi.fn(),
        ingestText: vi.fn(),
        uploadFile: vi.fn(),
        listFiles: vi.fn()
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
            bio: 'Test Bio',
            preferences: {},
            analyzedTrackIds: [],
            knowledgeBase: [],
            savedWorkflows: [],
            brandKit: {
                colors: [],
                fonts: '',
                brandDescription: '',
                negativePrompt: '',
                socials: {},
                brandAssets: [],
                referenceImages: [],
                releaseDetails: {
                    title: '',
                    type: '',
                    artists: '',
                    genre: '',
                    mood: '',
                    themes: '',
                    lyrics: ''
                }
            }
        };

        const mockAudioTrack: AudioAnalysisJob | null = null;
        const mockOnUpdate = vi.fn();
        const mockUpdateDocStatus = vi.fn();

        it('should initialize corpus and query successfully', async () => {
            const mockAnswer = {
                candidates: [
                    {
                        content: { parts: [{ text: 'This is the answer from RAG.' }] },
                        groundingAttributions: [
                            {
                                sourceId: 'corpora/test-corpus/documents/doc1',
                                content: { parts: [{ text: 'Source passage' }] }
                            }
                        ]
                    }
                ]
            };

            const mockFiles = [{ name: 'files/123', uri: 'gs://...', mimeType: 'text/plain' }];

            (GeminiRetrieval.listFiles as any).mockResolvedValue({ files: mockFiles });
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
            expect(result.asset.tags).toContain('rag');
            expect(mockOnUpdate).toHaveBeenCalledWith('Initializing Gemini Knowledge Base...');
        });

        it('should handle fallback when retrieval fails', async () => {
            (GeminiRetrieval.listFiles as any).mockRejectedValue(new Error('List failed'));
            (AI.generateText as any).mockResolvedValue('Fallback LLM answer.');

            const result = await runAgenticWorkflow(
                'Query',
                mockUserProfile,
                mockAudioTrack,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            expect(result.asset.content).toBe('Fallback LLM answer.');
            expect(result.asset.tags).toContain('general-knowledge');
        });
    });

    describe('processForKnowledgeBase', () => {
        it('should extract metadata and upload file', async () => {
            const mockFile = { name: 'files/abc', uri: 'gs://foo', mimeType: 'text/plain' };

            (AI.generateStructuredData as any).mockResolvedValue({
                title: 'Extracted Title',
                summary: 'This is the summary.'
            });

            (GeminiRetrieval.uploadFile as any).mockResolvedValue(mockFile);

            const result = await processForKnowledgeBase(
                'Raw content to process',
                'document.pdf',
                { size: '1.5 MB', type: 'application/pdf' }
            );

            expect(result.title).toBe('Extracted Title');
            expect(result.tags).toContain('gemini-file');
            expect(result.embeddingId).toBe('files/abc');

            expect(GeminiRetrieval.uploadFile).toHaveBeenCalledWith(
                'Extracted Title',
                'Raw content to process'
            );
        });

        it('should use fallback title if metadata extraction fails', async () => {
            const mockFile = { name: 'files/abc', uri: 'gs://foo', mimeType: 'text/plain' };

            (AI.generateStructuredData as any).mockRejectedValue(new Error('Extraction failed'));
            (GeminiRetrieval.uploadFile as any).mockResolvedValue(mockFile);

            const result = await processForKnowledgeBase(
                'Content',
                'fallback-source.txt'
            );

            expect(result.title).toBe('fallback-source.txt');
            expect(GeminiRetrieval.uploadFile).toHaveBeenCalledWith('fallback-source.txt', 'Content');
        });

        it('should handle upload failure gracefully', async () => {
            (AI.generateStructuredData as any).mockResolvedValue({
                title: 'Title',
                summary: 'Summary'
            });
            (GeminiRetrieval.uploadFile as any).mockRejectedValue(new Error('Upload failed'));

            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.title).toBe('Title');
            expect(result.tags).toContain('error');
            expect(result.content).toBe('Failed to process');
        });
    });
});
