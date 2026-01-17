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
            userProfile: {
                id: 'test-user',
                uid: 'test-user',
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: null,
                createdAt: { seconds: 0, nanoseconds: 0 } as any,
                updatedAt: { seconds: 0, nanoseconds: 0 } as any,
                lastLoginAt: { seconds: 0, nanoseconds: 0 } as any,
                emailVerified: true,
                membership: { tier: 'free' as any, expiresAt: null },
                preferences: { theme: 'dark' as any, notifications: true },
                accountType: 'artist' as any,
                bio: 'Test Bio'
            },
            brandKit: {
                brandDescription: 'Dark and Moody',
                colors: ['#000000', '#ffffff'],
                fonts: 'Helvetica',
                negativePrompt: 'blurry',
                releaseDetails: {
                    title: 'The Abyss',
                    type: 'EP',
                    mood: 'Dark',
                    themes: 'Isolation',
                    artists: 'Test Artist',
                    genre: 'Dark Electronic',
                    lyrics: ''
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

        // Mock AI response with native function calling format
        (AI.generateContentStream as any).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => 'Understood. The brand context has been loaded.' };
                }
            },
            response: Promise.resolve({
                text: () => 'Understood. The brand context has been loaded.',
                functionCalls: () => null // No function calls
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

    it('should execute generate_image tool when requested by AI via native function calling', async () => {
        // Mock AI to return a native function call (not JSON)
        (AI.generateContentStream as any).mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => 'I will generate the image for you.' };
                }
            },
            response: Promise.resolve({
                text: () => 'I will generate the image for you.',
                functionCalls: () => [{
                    name: 'generate_image',
                    args: { prompt: 'A cool cat' }
                }]
            })
        });

        // Use dynamic import to spy on the singleton instance used by the tools
        const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
        const generateSpy = vi.spyOn(ImageGeneration, 'generateImages').mockResolvedValue([
            { id: 'img-1', url: 'http://img.com/1', prompt: 'A cool cat' }
        ]);

        await agent.execute('Make a cat image');

        expect(generateSpy).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A cool cat'
        }));
    });

    it('should have native function declarations configured', async () => {
        await agent.initialize();
        // Verify the agent has proper tool declarations
        expect(agent.tools).toBeDefined();
        expect(agent.tools.length).toBeGreaterThan(0);

        const declarations = agent.tools[0]?.functionDeclarations || [];
        const toolNames = declarations.map((d: any) => d.name);

        expect(toolNames).toContain('generate_image');
        expect(toolNames).toContain('generate_video');
        expect(toolNames).toContain('save_memory');
        expect(toolNames).toContain('recall_memories');
        expect(toolNames).toContain('delegate_task');
    });

    it('should have access to full TOOL_REGISTRY via functions property', async () => {
        await agent.initialize();
        const agentAny = agent as any;
        expect(agentAny.functions).toBeDefined();
        expect(Object.keys(agentAny.functions).length).toBeGreaterThan(5);

        // Verify core tools are accessible
        expect(agentAny.functions).toHaveProperty('generate_image');
        expect(agentAny.functions).toHaveProperty('save_memory');
        expect(agentAny.functions).toHaveProperty('list_projects');
    });
});
