
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralistAgent } from './GeneralistAgent';
import { useStore } from '@/core/store';
import { GenAI as AI } from '@/services/ai/GenAI';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
        setState: vi.fn()
    }
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContentStream: vi.fn(),
        generateContent: vi.fn()
    }
}));

// Mock the tool registry to avoid circular dependencies and actual tool execution
vi.mock('../tools', () => ({
    TOOL_REGISTRY: {
        delegate_task: vi.fn().mockResolvedValue({ status: 'success', output: 'Task delegated successfully' }),
        save_memory: vi.fn().mockResolvedValue({ status: 'success' }),
        recall_memories: vi.fn().mockResolvedValue([]),
        list_projects: vi.fn().mockResolvedValue([])
    }
}));

describe('GeneralistAgent Routing Logic', () => {
    let agent: GeneralistAgent;

    beforeEach(async () => {
        vi.clearAllMocks();
        agent = new GeneralistAgent();

        // Mock store state
        vi.mocked(useStore.getState).mockReturnValue({
            currentOrganizationId: 'org-1',
            currentProjectId: 'proj-1',
            uploadedImages: [],
            agentHistory: [],
            studioControls: {
                resolution: '1080p',
                aspectRatio: '1:1',
                negativePrompt: ''
            },
            addToHistory: vi.fn()
        } as any);

        await agent.initialize();
    });

    /**
     * Helper to mock AI responses for routing tests
     */
    const mockDelegationResponse = (targetAgentId: string, task: string) => {
        let callCount = 0;
        vi.mocked(AI.generateContentStream).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => `Delegating to ${targetAgentId}...` };
                        }
                    },
                    response: Promise.resolve({
                        text: () => `Delegating to ${targetAgentId}...`,
                        functionCalls: () => [{
                            name: 'delegate_task',
                            args: { targetAgentId, task }
                        }],
                        usage: () => ({ totalTokenCount: 100 })
                    })
                } as any;
            } else {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => 'Task completed.' };
                        }
                    },
                    response: Promise.resolve({
                        text: () => 'Task completed.',
                        functionCalls: () => [],
                        usage: () => ({ totalTokenCount: 50 })
                    })
                } as any;
            }
        });
    };

    /**
     * Helper to mock multiple turns of AI conversation
     */
    const mockMultiTurnResponse = (turns: Array<{ text?: string, functionCalls?: any[] }>) => {
        let callCount = 0;
        vi.mocked(AI.generateContentStream).mockImplementation(async () => {
            const turn = turns[callCount] || { text: 'Conversation finished.', functionCalls: [] };
            callCount++;
            
            return {
                stream: {
                    [Symbol.asyncIterator]: async function* () {
                        yield { text: () => turn.text || '' };
                    }
                },
                response: Promise.resolve({
                    text: () => turn.text || '',
                    functionCalls: () => turn.functionCalls || [],
                    usage: () => ({ totalTokenCount: 100 })
                })
            } as any;
        });
    };

    it('routes Music-specific tasks (ISRC) to the Music Agent', async () => {
        mockDelegationResponse('music', 'Assign ISRC code to Neon Nights');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Assign an ISRC code to my track Neon Nights');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'music'
        }), undefined);
    });

    it('routes Legal-specific tasks (Contract Review) to the Legal Agent', async () => {
        mockDelegationResponse('legal', 'Review my contract for this collaboration');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Review my contract for this collaboration');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'legal'
        }), undefined);
    });

    it('routes Tour Promotion to Marketing Agent (Tie-breaker rule)', async () => {
        // Tie-breaker: "I need merch for my tour" -> Merchandise (logistics vs product)
        // Tie-breaker: "How should I promote my upcoming tour dates?" -> Marketing
        mockDelegationResponse('marketing', 'Plan promotion for my upcoming tour dates');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('How should I promote my upcoming tour dates?');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'marketing'
        }), undefined);
    });

    it('routes Analytics queries to the Analytics Agent', async () => {
        mockDelegationResponse('analytics', 'Show my streaming metrics for the last 30 days');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Show my streaming metrics for the last 30 days');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'analytics'
        }), undefined);
    });

    it('routes Licensing queries (Sample Clearance) to the Licensing Agent', async () => {
        mockDelegationResponse('licensing', 'Is this sample legally cleared to use?');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Is this sample legally cleared to use?');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'licensing'
        }), undefined);
    });

    it('handles ambiguous requests via Hub Orchestration (Creative + Social + Video)', async () => {
        // "Create content for my release" -> Hub orchestration (needs Creative + Social + Video)
        
        let callCount = 0;
        vi.mocked(AI.generateContentStream).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => 'I will coordinate a multi-disciplinary plan.' };
                        }
                    },
                    response: Promise.resolve({
                        text: () => 'I will coordinate a multi-disciplinary plan.',
                        functionCalls: () => [
                            { name: 'delegate_task', args: { targetAgentId: 'creative', task: 'Generate album art' } },
                            { name: 'delegate_task', args: { targetAgentId: 'social', task: 'Plan social rollout' } }
                        ],
                        usage: () => ({ totalTokenCount: 100 })
                    })
                } as any;
            } else {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => 'The plan is set.' };
                        }
                    },
                    response: Promise.resolve({
                        text: () => 'The plan is set.',
                        functionCalls: () => [],
                        usage: () => ({ totalTokenCount: 50 })
                    })
                } as any;
            }
        });

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Create content for my new release');

        expect(delegateSpy).toHaveBeenCalledTimes(2);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'creative' }), undefined);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'social' }), undefined);
    });

    it('handles triple-parallel routing (Brand + Marketing + Social)', async () => {
        let callCount = 0;
        vi.mocked(AI.generateContentStream).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => 'Coordinating brand, marketing, and social.' };
                        }
                    },
                    response: Promise.resolve({
                        text: () => 'Coordinating brand, marketing, and social.',
                        functionCalls: () => [
                            { name: 'delegate_task', args: { targetAgentId: 'brand', task: 'Design logo' } },
                            { name: 'delegate_task', args: { targetAgentId: 'marketing', task: 'Plan campaign' } },
                            { name: 'delegate_task', args: { targetAgentId: 'social', task: 'Draft posts' } }
                        ],
                        usage: () => ({ totalTokenCount: 150 })
                    })
                } as any;
            } else {
                return {
                    stream: {
                        [Symbol.asyncIterator]: async function* () {
                            yield { text: () => 'All specialists engaged.' };
                        }
                    },
                    response: Promise.resolve({
                        text: () => 'All specialists engaged.',
                        functionCalls: () => [],
                        usage: () => ({ totalTokenCount: 50 })
                    })
                } as any;
            }
        });

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('I need a full brand identity and social rollout for my new tour');

        expect(delegateSpy).toHaveBeenCalledTimes(3);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'brand' }), undefined);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'marketing' }), undefined);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'social' }), undefined);
    });

    it('handles sequential multi-agent orchestration (Legal -> Marketing)', async () => {
        mockMultiTurnResponse([
            { 
                text: 'First, I will have Legal review the agreement.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'legal', task: 'Review the distribution agreement' } }] 
            },
            { 
                text: 'Now that Legal has reviewed it, I will ask Marketing for a rollout plan based on the terms.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'marketing', task: 'Create rollout plan' } }] 
            },
            { text: 'All set.' }
        ]);

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Review this agreement and then plan a rollout');

        expect(delegateSpy).toHaveBeenCalledTimes(2);
        expect(delegateSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ targetAgentId: 'legal' }), undefined);
        expect(delegateSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ targetAgentId: 'marketing' }), undefined);
    });

    it('passes sharedContext during delegation when relevant', async () => {
        let callCount = 0;
        vi.mocked(AI.generateContentStream).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    stream: { [Symbol.asyncIterator]: async function* () { yield { text: () => 'Delegating with context.' }; } },
                    response: Promise.resolve({
                        text: () => 'Delegating with context.',
                        functionCalls: () => [{
                            name: 'delegate_task',
                            args: { 
                                targetAgentId: 'brand', 
                                task: 'Design logo', 
                                sharedContext: 'Artist style: Cyberpunk, Neon colors' 
                            }
                        }],
                        usage: () => ({ totalTokenCount: 100 })
                    })
                } as any;
            } else {
                return {
                    stream: { [Symbol.asyncIterator]: async function* () { yield { text: () => 'Done.' }; } },
                    response: Promise.resolve({ text: () => 'Done.', functionCalls: () => [], usage: () => ({ totalTokenCount: 50 }) })
                } as any;
            }
        });

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('Design a logo. The artist style is Cyberpunk with Neon colors.');

        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'brand',
            sharedContext: 'Artist style: Cyberpunk, Neon colors'
        }), undefined);
    });

    it('prioritizes Finance over Video for budget-related creative questions (Ambiguity Protocol)', async () => {
        mockDelegationResponse('finance', 'Calculate budget allocation for music video');
        
        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('How much should I spend on my music video?');

        // Protocol: "Money or contracts involved -> Finance or Legal first"
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'finance'
        }), undefined);
    });

    it('integrates tool results into routing decisions (Recall -> Delegate)', async () => {
        mockMultiTurnResponse([
            { 
                text: 'Checking past memories about your branding...', 
                functionCalls: [{ name: 'recall_memories', args: { query: 'branding style' } }] 
            },
            { 
                text: 'Based on your past branding, I will delegate to the Social agent.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'social', task: 'Draft posts matching past style' } }] 
            },
            { text: 'Done.' }
        ]);

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);
        const recallSpy = vi.mocked(TOOL_REGISTRY.recall_memories);

        await agent.execute('Create a social post based on my existing branding');

        expect(recallSpy).toHaveBeenCalled();
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
            targetAgentId: 'social'
        }), undefined);
    });

    it('orchestrates a full "Social Media Launch" involving multiple specialist turns', async () => {
        mockMultiTurnResponse([
            { 
                text: 'To launch your social media site, I will first have Brand design the profile aesthetics.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'brand', task: 'Design profile and banner aesthetics' } }] 
            },
            { 
                text: 'Now I will have Social set up the initial account structures and engagement plan.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'social', task: 'Initialize social site accounts and engagement plan' } }] 
            },
            { 
                text: 'Finally, I will have Marketing prepare the day-one promotion strategy.', 
                functionCalls: [{ name: 'delegate_task', args: { targetAgentId: 'marketing', task: 'Day-one launch strategy' } }] 
            },
            { text: 'The social media launch plan is ready.' }
        ]);

        const { TOOL_REGISTRY } = await import('../tools');
        const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

        await agent.execute('I want to launch my social media site');

        expect(delegateSpy).toHaveBeenCalledTimes(3);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'brand' }), undefined);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'social' }), undefined);
        expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({ targetAgentId: 'marketing' }), undefined);
    });

    describe('Phase 2 Keywords & Migration Logic', () => {
        it('routes Catalog Migration to Distribution Agent', async () => {
            mockDelegationResponse('distribution', 'Move catalog from DistroKid and start takeover');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('I want to move my catalog from DistroKid to indiiOS. How do I start the takeover?');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'distribution'
            }), undefined);
        });

        it('routes Historical Royalties to Finance Agent', async () => {
            mockDelegationResponse('finance', 'Import royalty statements and accounting migration');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Import my royalty statements from 2023 for accounting migration.');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'finance'
            }), undefined);
        });

        it('routes Sonic DNA Training to Music Agent', async () => {
            mockDelegationResponse('music', 'Analyze stems for sonic DNA training and style analysis');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Analyze these stems for sonic DNA training and style analysis.');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'music'
            }), undefined);
        });

        it('routes Brand Voice Training to Brand Agent', async () => {
            mockDelegationResponse('brand', 'Train brand voice agent and persona calibration');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Train my brand voice agent based on my persona calibration.');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'brand'
            }), undefined);
        });

        it('routes Visual Style Reference to Director Agent', async () => {
            mockDelegationResponse('director', 'Process visual training and style reference');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Use these previous covers as a style reference for visual training.');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'director'
            }), undefined);
        });

        it('handles Team Management directly as a Hub task', async () => {
            // "Add my manager Sarah" -> Should NOT delegate to a specialist
            mockMultiTurnResponse([{ text: 'I will add Sarah to your workspace with editor permissions.' }]);
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Add my manager, Sarah, to this project with editor permissions.');

            expect(delegateSpy).not.toHaveBeenCalled();
        });

        it('routes Native Platform actions to Social Agent', async () => {
            mockDelegationResponse('social', 'Post exclusive update to indiiOS feed');
            
            const { TOOL_REGISTRY } = await import('../tools');
            const delegateSpy = vi.mocked(TOOL_REGISTRY.delegate_task);

            await agent.execute('Post an exclusive update to my indiiOS feed.');

            expect(delegateSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetAgentId: 'social'
            }), undefined);
        });
    });
});
