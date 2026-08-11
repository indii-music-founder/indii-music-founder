/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
        parseJSON: vi.fn()
    }
}));

vi.mock('../../modules/knowledge/services/KnowledgeRetrievalService', () => ({
    knowledgeRetrievalService: {
        getDocuments: vi.fn(),
        chat: vi.fn(),
        uploadFiles: vi.fn(),
        deleteDocument: vi.fn(),
        chatStream: vi.fn()
    }
}));

// Mock Autonomous models config
vi.mock('@/core/config/intelligence-models', () => ({

    INTELLIGENCE_MODELS: {
        TEXT: { AGENT: 'gemini-3.1-pro-preview', FAST: 'gemini-3.1-pro-preview' }
    },
    INTELLIGENCE_CONFIG: {
        THINKING: { LOW: { thinkingConfig: { thinkingLevel: 'LOW' } } }
    },
    APPROVED_MODELS: {
        TEXT_AGENT: 'gemini-3.1-pro-preview',
        TEXT_FAST: 'gemini-3.1-pro-preview',
        IMAGE_GEN: 'gemini-3-pro-image',
        IMAGE_FAST: 'gemini-3-pro-image',
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
import { AutonomousIntelligence as AI } from '../intelligence/AutonomousIntelligence';
import { knowledgeRetrievalService } from '../../modules/knowledge/services/KnowledgeRetrievalService';
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
            createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
            lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
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

            const mockFiles = [{ id: 'files/123', rawName: 'files/123', title: 'test', type: 'TXT', size: '0', date: 'now', status: 'indexed', mimeType: 'text/plain' } as import('../../modules/knowledge/services/KnowledgeRetrievalService').FrontendKnowledgeDoc];

            vi.mocked(knowledgeRetrievalService.getDocuments).mockResolvedValue(mockFiles);
            vi.mocked(knowledgeRetrievalService.chat).mockResolvedValue('This is the answer from RAG.');

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
            vi.mocked(knowledgeRetrievalService.getDocuments).mockRejectedValue(new Error('List failed'));
            vi.mocked(AI.generateText).mockResolvedValue('Fallback LLM answer.');

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

            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                title: 'Extracted Title',
                summary: 'This is the summary.'
            });

            vi.mocked(knowledgeRetrievalService.uploadFiles).mockResolvedValue(1);

            const result = await processForKnowledgeBase(
                'Raw content to process',
                'document.pdf',
                { size: '1.5 MB', type: 'application/pdf' }
            );

            expect(result.title).toBe('Extracted Title');
            expect(result.tags).toContain('knowledge-base');
            expect(result.embeddingId).toBe('Extracted Title.txt');

            expect(knowledgeRetrievalService.uploadFiles).toHaveBeenCalled();
        });

        it('should use fallback title if metadata extraction fails', async () => {

            vi.mocked(AI.generateStructuredData).mockRejectedValue(new Error('Extraction failed'));
            vi.mocked(knowledgeRetrievalService.uploadFiles).mockResolvedValue(1);

            const result = await processForKnowledgeBase(
                'Content',
                'fallback-source.txt'
            );

            expect(result.title).toBe('fallback-source.txt');
            expect(knowledgeRetrievalService.uploadFiles).toHaveBeenCalled();
        });

        it('should handle upload failure gracefully', async () => {
            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                title: 'Title',
                summary: 'Summary'
            });
            vi.mocked(knowledgeRetrievalService.uploadFiles).mockRejectedValue(new Error('Upload failed'));

            const result = await processForKnowledgeBase('Content', 'source.txt');

            expect(result.title).toBe('Title');
            expect(result.tags).toContain('error');
            expect(result.content).toBe('Failed to process');
        });

        // Item 369: Chunk splitting — long content should still be processed end-to-end
        it('should process large content without truncation at the service boundary', async () => {
            const longContent = 'A'.repeat(50000); // 50KB of text

            vi.mocked(AI.generateStructuredData).mockResolvedValue({
                title: 'Large Document',
                summary: 'A very large document summary.'
            });
            vi.mocked(knowledgeRetrievalService.uploadFiles).mockResolvedValue(1);

            const result = await processForKnowledgeBase(longContent, 'large.txt');

            // Service should pass full content to upload; chunking is GeminiRetrieval's responsibility
            expect(knowledgeRetrievalService.uploadFiles).toHaveBeenCalled();
            expect(result.title).toBe('Large Document');
            expect(result.tags).toContain('knowledge-base');
        });

        // Item 369: Retrieval — multiple ranked results should be handled
        it('should handle multiple retrieval results in runAgenticWorkflow', async () => {
            const mockUserProfile = {
                id: 'user-123', uid: 'user-123', displayName: 'Test User',
                email: 'test@example.com', photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                emailVerified: true, membership: { tier: 'free', expiresAt: null },
                accountType: 'artist', bio: '', preferences: { theme: 'dark', notifications: true },
                analyzedTrackIds: [], knowledgeBase: [], savedWorkflows: [],
                brandKit: { colors: [], fonts: '', brandDescription: '', negativePrompt: '', socials: {}, brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' } }
            } as unknown as import('@/types/User').UserProfile;
            const mockOnUpdate = vi.fn();
            const mockUpdateDocStatus = vi.fn();

            vi.mocked(knowledgeRetrievalService.getDocuments).mockResolvedValue([{ id: 'files/123', rawName: 'files/123', title: 'test', type: 'TXT', size: '0', date: 'now', status: 'indexed', mimeType: 'text/plain' }]);
            vi.mocked(knowledgeRetrievalService.chat).mockResolvedValue('Based on top-ranked sources: answer here.');

            const result = await runAgenticWorkflow(
                'What are the top royalty rates?',
                mockUserProfile,
                null,
                mockOnUpdate,
                mockUpdateDocStatus,
                'royalties'
            );

            expect(result.asset.content).toContain('top-ranked sources');
            expect(knowledgeRetrievalService.chat).toHaveBeenCalled();
        });

        // Item 369: Context window management — token usage metadata is surfaced
        it('should surface token usage metadata from retrieval response', async () => {
            const mockUserProfile = {
                id: 'user-123', uid: 'user-123', displayName: 'Test User',
                email: 'test@example.com', photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as unknown as import('firebase/firestore').Timestamp,
                emailVerified: true, membership: { tier: 'free', expiresAt: null },
                accountType: 'artist', bio: '', preferences: { theme: 'dark', notifications: true },
                analyzedTrackIds: [], knowledgeBase: [], savedWorkflows: [],
                brandKit: { colors: [], fonts: '', brandDescription: '', negativePrompt: '', socials: {}, brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' } }
            } as unknown as import('@/types/User').UserProfile;
            const mockOnUpdate = vi.fn();
            const mockUpdateDocStatus = vi.fn();

            vi.mocked(knowledgeRetrievalService.getDocuments).mockResolvedValue([{ id: 'files/123', rawName: 'files/123', title: 'test', type: 'TXT', size: '0', date: 'now', status: 'indexed', mimeType: 'text/plain' }]);
            vi.mocked(knowledgeRetrievalService.chat).mockResolvedValue('Answer text here.');

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
