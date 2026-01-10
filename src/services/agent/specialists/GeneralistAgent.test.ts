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
            agentHistory: []
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
                getReader: () => ({
                    read: vi.fn()
                        .mockResolvedValueOnce({ done: false, value: { text: () => JSON.stringify({ final_response: 'Understood.' }) } })
                        .mockResolvedValueOnce({ done: true }),
                    releaseLock: vi.fn()
                })
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
    });
});
