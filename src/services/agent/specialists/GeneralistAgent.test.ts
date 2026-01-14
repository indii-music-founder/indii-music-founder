import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralistAgent } from './GeneralistAgent';
import { useStore } from '@/core/store';
import { AI } from '@/services/ai/AIService';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/ai/AIService');

describe('GeneralistAgent', () => {
    let agent: GeneralistAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new GeneralistAgent();

        // Mock current store state
        (useStore.getState as any).mockReturnValue({
            currentOrganizationId: 'org-1',
            currentProjectId: 'proj-1',
            uploadedImages: [],
            agentHistory: [],
            studioControls: {
                resolution: '1024x1024',
                aspectRatio: '1:1',
                negativePrompt: ''
            },
            addToHistory: vi.fn()
        });
    });

    it('should include comprehensive BrandKit context in system prompt', async () => {
        // Setup a context with full BrandKit data
        const context = {
            userProfile: { bio: 'Test Bio' },
            brandKit: {
                brandDescription: 'Dark and Moody',
                colors: ['#000000', '#ffffff'],
                fonts: 'Helvetica',
                negativePrompt: 'blurry',
                releaseDetails: {
                    title: 'The Abyss',
                    type: 'EP',
                    mood: 'Dark',
                    themes: 'Isolation'
                },
                socials: {
                    twitter: '@test',
                    spotify: 'https://spotify.com/test',
                    pro: 'ASCAP',
                    distributor: 'DistroKid'
                },
                brandAssets: [],
                referenceImages: []
            }
        };

        // Mock AI response to avoid actual call
        (AI.generateContentStream as any).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => JSON.stringify({ final_response: 'Understood.' }) };
                }
            },
            response: Promise.resolve({
                text: () => JSON.stringify({ final_response: 'Understood.' }),
                functionCalls: () => []
            })
        });

        // Spy on the AI call to inspect the prompt
        const generateSpy = vi.spyOn(AI, 'generateContentStream');

        await agent.execute('Test task', context);

        // Verify the prompt contains the injected data
        const callArgs: any = generateSpy.mock.calls[0]?.[0];
        const promptText = callArgs?.contents?.[0]?.parts?.find((p: any) => p.text?.includes('BRAND CONTEXT'))?.text;

        expect(promptText).toBeDefined();
        expect(promptText).toContain('Identity: Test Bio');
        expect(promptText).toContain('Visual Style: Dark and Moody');
        expect(promptText).toContain('Spotify: https://spotify.com/test');
        expect(promptText).toContain('PRO: ASCAP');
        expect(promptText).toContain('Distributor: DistroKid');
        expect(promptText).toContain('Distributor: DistroKid');
    });

    it('should execute generate_image tool when requested by AI', async () => {
        // Mock AI to return a tool call
        const toolCallJson = JSON.stringify({
            thought: "I need to generate an image.",
            tool: "generate_image",
            args: { prompt: "A cool cat", count: 1 }
        });

        (AI.generateContentStream as any).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => toolCallJson };
                    yield { text: () => JSON.stringify({ final_response: "Image generated." }) };
                }
            },
            response: Promise.resolve({ text: () => toolCallJson })
        });

        // Use dynamic import to spy on the singleton instance used by the tools
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        const generateSpy = vi.spyOn(ImageGeneration, 'generateImages').mockResolvedValue([
            { id: 'img-1', url: 'http://img.com/1', prompt: 'A cool cat' }
        ]);

        await agent.execute('Make a cat image');

        expect(generateSpy).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A cool cat',
            count: 1
        }));
    });
});
