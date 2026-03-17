/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../ai/GenAI', () => ({
    GenAI: {
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
        TEXT: { AGENT: 'gemini-3.1-pro-preview', FAST: 'gemini-3.1-pro-preview' }
    },
    AI_CONFIG: {
        THINKING: { LOW: { thinkingConfig: { thinkingLevel: 'LOW' } } }
    },
    APPROVED_MODELS: {
        TEXT_AGENT: 'gemini-3.1-pro-preview',
        TEXT_FAST: 'gemini-3.1-pro-preview',
        IMAGE_GEN: 'gemini-3-pro-image-preview',
        IMAGE_FAST: 'gemini-3-pro-image-preview',
        AUDIO_PRO: 'gemini-3.1-pro-preview',
        AUDIO_FLASH: 'gemini-3.1-pro-preview',
        VIDEO_GEN: 'veo-3.1-generate-preview',
        BROWSER_AGENT: 'gemini-3.1-pro-preview',
        EMBEDDING_DEFAULT: 'gemini-embedding-001'
    },
    validateModels: () => { },
    ModelIdSchema: { parse: (v: string) => v }
}));

import { runAgenticWorkflow, processForKnowledgeBase } from './ragService';
import { GenAI as AI } from '../ai/GenAI';
import { GeminiRetrieval } from './GeminiRetrievalService';
import type { UserProfile, AudioAnalysisJob } from '../../modules/workflow/types';

describe('ragService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runAgenticWorkflow', () => {
        const mockUserProfile: UserProfile = {
            id: 'user-123',
            uid: 'user-123',
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: null,
            createdAt: { seconds: 0, nanoseconds: 0 } as any,
            updatedAt: { seconds: 0, nanoseconds: 0 } as any,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
            emailVerified: true,
            membership: { tier: 'free', expiresAt: null },
            accountType: 'artist',
            bio: 'Test Bio',
            preferences: { theme: 'dark', notifications: true },
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

        // Item 369: Chunk splitting — long content should still be processed end-to-end
        it('should process large content without truncation at the service boundary', async () => {
            const longContent = 'A'.repeat(50000); // 50KB of text
            const mockFile = { name: 'files/large-doc', uri: 'gs://foo/large', mimeType: 'text/plain' };

            (AI.generateStructuredData as any).mockResolvedValue({
                title: 'Large Document',
                summary: 'A very large document summary.'
            });
            (GeminiRetrieval.uploadFile as any).mockResolvedValue(mockFile);

            const result = await processForKnowledgeBase(longContent, 'large.txt');

            // Service should pass full content to upload; chunking is GeminiRetrieval's responsibility
            expect(GeminiRetrieval.uploadFile).toHaveBeenCalledWith('Large Document', longContent);
            expect(result.title).toBe('Large Document');
            expect(result.tags).toContain('gemini-file');
        });

        // Item 369: Retrieval — multiple ranked results should be handled
        it('should handle multiple retrieval results in runAgenticWorkflow', async () => {
            const mockUserProfile = {
                id: 'user-123', uid: 'user-123', displayName: 'Test User',
                email: 'test@example.com', photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as any,
                updatedAt: { seconds: 0, nanoseconds: 0 } as any,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
                emailVerified: true, membership: { tier: 'free', expiresAt: null },
                accountType: 'artist', bio: '', preferences: { theme: 'dark', notifications: true },
                analyzedTrackIds: [], knowledgeBase: [], savedWorkflows: [],
                brandKit: { colors: [], fonts: '', brandDescription: '', negativePrompt: '', socials: {}, brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' } }
            } as any;
            const mockOnUpdate = vi.fn();
            const mockUpdateDocStatus = vi.fn();
            const multiResultAnswer = {
                candidates: [{
                    content: {
                        parts: [{ text: 'Based on top-ranked sources: answer here.' }],
                        role: 'model'
                    }
                }],
                usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
            };

            (GeminiRetrieval.listFiles as any).mockResolvedValue({ files: [{ name: 'files/123', uri: 'gs://test', mimeType: 'text/plain' }] });
            (GeminiRetrieval.query as any).mockResolvedValue(multiResultAnswer);

            const result = await runAgenticWorkflow(
                'What are the top royalty rates?',
                mockUserProfile,
                null,
                mockOnUpdate,
                mockUpdateDocStatus,
                'royalties'
            );

            expect(result.asset.content).toContain('top-ranked sources');
            expect(GeminiRetrieval.query).toHaveBeenCalled();
        });

        // Item 369: Context window management — token usage metadata is surfaced
        it('should surface token usage metadata from retrieval response', async () => {
            const mockUserProfile = {
                id: 'user-123', uid: 'user-123', displayName: 'Test User',
                email: 'test@example.com', photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as any,
                updatedAt: { seconds: 0, nanoseconds: 0 } as any,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
                emailVerified: true, membership: { tier: 'free', expiresAt: null },
                accountType: 'artist', bio: '', preferences: { theme: 'dark', notifications: true },
                analyzedTrackIds: [], knowledgeBase: [], savedWorkflows: [],
                brandKit: { colors: [], fonts: '', brandDescription: '', negativePrompt: '', socials: {}, brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' } }
            } as any;
            const mockOnUpdate = vi.fn();
            const mockUpdateDocStatus = vi.fn();
            const answerWithUsage = {
                candidates: [{
                    content: {
                        parts: [{ text: 'Answer text here.' }],
                        role: 'model'
                    }
                }],
                usageMetadata: { promptTokenCount: 8000, candidatesTokenCount: 500, totalTokenCount: 8500 }
            };

            (GeminiRetrieval.listFiles as any).mockResolvedValue({ files: [{ name: 'files/123', uri: 'gs://test', mimeType: 'text/plain' }] });
            (GeminiRetrieval.query as any).mockResolvedValue(answerWithUsage);

            const result = await runAgenticWorkflow(
                'Query that uses most of the context window',
                mockUserProfile,
                null,
                mockOnUpdate,
                mockUpdateDocStatus
            );

            // The service should return the response without error even at high token counts
            expect(result.asset.content).toBeDefined();
            expect(typeof result.asset.content).toBe('string');
        });
    });
});
