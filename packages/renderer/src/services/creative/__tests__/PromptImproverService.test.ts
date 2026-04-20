import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptImproverService, ImprovedPromptResult } from '../PromptImproverService';
import { GenAI } from '@/services/ai/GenAI';

// Mock GenAI
vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateStructuredData: vi.fn()
    }
}));

// Mock store (dynamic import pattern used by the service)
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            userProfile: {
                displayName: 'TestArtist',
                brandKit: {
                    brandDescription: 'Dark cinematic hip-hop aesthetics',
                    aestheticStyle: 'Neo-noir urban',
                    colors: ['#1a1a2e', '#e94560', '#0f3460'],
                    releaseDetails: {
                        mood: 'Intense',
                        themes: 'Struggle, resilience, triumph',
                        genre: 'Hip-Hop'
                    },
                    negativePrompt: 'cartoon, anime, childish'
                }
            }
        }))
    },
    logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('PromptImproverService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw if prompt is empty', async () => {
        await expect(
            PromptImproverService.improve({ rawPrompt: '', mode: 'image' })
        ).rejects.toThrow('Cannot improve an empty prompt.');
    });

    it('should throw if prompt is only whitespace', async () => {
        await expect(
            PromptImproverService.improve({ rawPrompt: '   ', mode: 'image' })
        ).rejects.toThrow('Cannot improve an empty prompt.');
    });

    it('should call GenAI.generateStructuredData with image-mode system instructions', async () => {
        const mockResult: ImprovedPromptResult = {
            improved: 'Sony A7III, 85mm f/1.4, shallow depth of field, a rapper standing on a dark stage bathed in crimson neon, volumetric fog, low-key dramatic lighting',
            reasoning: 'Added camera specs, lens details, lighting, and atmospheric elements'
        };

        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

        const result = await PromptImproverService.improve({
            rawPrompt: 'rapper on dark stage',
            mode: 'image'
        });

        expect(result.improved).toBe(mockResult.improved);
        expect(result.reasoning).toBe(mockResult.reasoning);
        expect(GenAI.generateStructuredData).toHaveBeenCalledTimes(1);

        // Verify the prompt passed to GenAI includes image-specific instructions
        const callArgs = (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0];
        const promptText = callArgs![0] as string;
        expect(promptText).toContain('photographic image');
        expect(promptText).toContain('camera model');
        expect(promptText).toContain('rapper on dark stage');
    });

    it('should call GenAI.generateStructuredData with video-mode system instructions', async () => {
        const mockResult: ImprovedPromptResult = {
            improved: 'Cinematic drone shot, slow dolly-in to a rapper on a dark stage, volumetric crimson lighting cascading through haze, 24fps, 8-second steady tracking shot',
            reasoning: 'Added camera movement, temporal pacing, and atmospheric details for video generation'
        };

        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

        const result = await PromptImproverService.improve({
            rawPrompt: 'rapper on dark stage',
            mode: 'video'
        });

        expect(result.improved).toBe(mockResult.improved);

        const callArgs = (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0];
        const promptText = callArgs![0] as string;
        expect(promptText).toContain('cinematic video');
        expect(promptText).toContain('camera movement');
    });

    it('should inject brand context into the prompt', async () => {
        const mockResult: ImprovedPromptResult = {
            improved: 'Enhanced prompt with brand context',
            reasoning: 'Injected brand colors and mood'
        };

        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

        await PromptImproverService.improve({
            rawPrompt: 'portrait of me',
            mode: 'image'
        });

        const callArgs = (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0];
        const promptText = callArgs![0] as string;

        // Should include brand context from the mocked store
        expect(promptText).toContain('TestArtist');
        expect(promptText).toContain('Dark cinematic hip-hop aesthetics');
        expect(promptText).toContain('Neo-noir urban');
        expect(promptText).toContain('#1a1a2e');
        expect(promptText).toContain('Intense');
        expect(promptText).toContain('Struggle, resilience, triumph');
    });

    it('should return original prompt as fallback if Gemini returns empty', async () => {
        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
            improved: '',
            reasoning: 'Could not improve'
        });

        const result = await PromptImproverService.improve({
            rawPrompt: 'my original prompt',
            mode: 'image'
        });

        expect(result.improved).toBe('my original prompt');
        expect(result.reasoning).toBe('No improvements could be generated.');
    });

    it('should provide default reasoning if Gemini returns empty reasoning', async () => {
        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
            improved: 'A beautifully improved prompt',
            reasoning: ''
        });

        const result = await PromptImproverService.improve({
            rawPrompt: 'raw prompt',
            mode: 'image'
        });

        expect(result.improved).toBe('A beautifully improved prompt');
        expect(result.reasoning).toBe('Enhanced with technical details and brand context.');
    });

    it('should throw a user-friendly error on GenAI failure', async () => {
        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Network timeout')
        );

        await expect(
            PromptImproverService.improve({ rawPrompt: 'test prompt', mode: 'image' })
        ).rejects.toThrow('Failed to improve prompt. Please try again.');
    });

    it('should pass correct JSON schema to GenAI', async () => {
        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
            improved: 'result',
            reasoning: 'reason'
        });

        await PromptImproverService.improve({
            rawPrompt: 'test',
            mode: 'image'
        });

        const callArgs = (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mock.calls[0];
        const schema = callArgs![1];

        expect(schema).toEqual({
            nullable: false,
            type: 'object',
            properties: {
                improved: {
                    type: 'string',
                    description: 'The rewritten, production-quality prompt'
                },
                reasoning: {
                    type: 'string',
                    description: 'Brief explanation of enhancements made'
                }
            },
            required: ['improved', 'reasoning']
        });
    });

    it('should trim the improved prompt output', async () => {
        (GenAI.generateStructuredData as ReturnType<typeof vi.fn>).mockResolvedValue({
            improved: '   padded result with whitespace   ',
            reasoning: 'reason'
        });

        const result = await PromptImproverService.improve({
            rawPrompt: 'test',
            mode: 'image'
        });

        expect(result.improved).toBe('padded result with whitespace');
    });
});
