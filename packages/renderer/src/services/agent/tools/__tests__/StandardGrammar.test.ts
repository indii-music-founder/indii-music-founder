
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenwriterTools } from '../ScreenwriterTools';
import { ProducerTools } from '../ProducerTools';
import { LegalTools } from '../LegalTools';
import { GenAI } from '@/services/ai/GenAI';

// Mock AI Models
vi.mock('@/core/config/ai-models', () => ({

    AI_MODELS: {
        TEXT: {
            AGENT: 'gemini-pro',
            FAST: 'gemini-flash'
        }
    },
    APPROVED_MODELS: {
        TEXT_AGENT: 'gemini-pro',
        TEXT_FAST: 'gemini-flash',
        IMAGE_GEN: 'mock-image-model',
        IMAGE_FAST: 'mock-image-model',
        AUDIO_PRO: 'gemini-pro',
        AUDIO_FLASH: 'gemini-flash',
        VIDEO_GEN: 'mock-video-model',
        BROWSER_AGENT: 'gemini-pro',
        EMBEDDING_DEFAULT: 'gemini-embedding-001'
    },
    validateModels: () => { },
    ModelIdSchema: { parse: (v: string) => v }
}));

describe('Standard Grammar Tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Screenwriter Agent', () => {
        it('format_screenplay requests JSON and parses it', async () => {
            const mockJson = JSON.stringify({
                title: "Test Scene",
                elements: [{ type: "slugline", text: "INT. TEST - DAY" }]
            });
            vi.mocked(GenAI.generateContent).mockResolvedValueOnce({
                response: { text: () => mockJson }
            } as any);

            const result = await ScreenwriterTools.format_screenplay({ text: 'John is at his desk.' });

            expect(result.success).toBe(true);
            expect(result.data.title).toBe("Test Scene");
        });
    });

    describe('Producer Agent', () => {
        it('create_call_sheet requests JSON and parses it', async () => {
            const mockJson = JSON.stringify({
                production: "Test Production",
                callTime: "08:00 AM",
                cast: []
            });
            vi.mocked(GenAI.generateContent).mockResolvedValueOnce({
                response: { text: () => mockJson }
            } as any);

            const result = await ProducerTools.create_call_sheet({
                date: '2025-10-27',
                location: 'Studio A',
                cast: ['Actor 1']
            });

            expect(result.success).toBe(true);
            const parsed = result.data;
            expect(parsed.production).toBe("Test Production");
        });
    });

    describe('Legal Agent', () => {
        it('draft_contract includes mandatory header', async () => {
            const mockContent = '# LEGAL AGREEMENT\n\nThis agreement...';
            const mockResponse = { response: { text: () => mockContent } };
            vi.mocked(GenAI.generateContent).mockResolvedValueOnce(mockResponse as unknown as Awaited<ReturnType<typeof GenAI.generateContent>>);

            const result = await LegalTools.draft_contract!({
                type: 'NDA',
                parties: ['Alice', 'Bob'],
                terms: 'Secrecy'
            });

            expect(result.success).toBe(true);
            expect(result.data.content).toContain('# LEGAL AGREEMENT');
        });
    });
});
