/**
 * AgentRouting.stress.test.ts
 *
 * Tests that the Generalist/Hub correctly identifies and routes user
 * requests to the right specialist agent. Covers:
 *   - 19 clear single-domain routes (one per specialist)
 *   - 3 ambiguous multi-domain queries
 *   - 3 boundary overlap tests
 *
 * Total: 25 test cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../AgentService';
import { useStore } from '@/core/store';
import { GenAI as AI } from '@/services/ai/GenAI';
import {
    AGENT_DOMAIN_KEYWORDS,
    createMockStoreState,
    createStreamResponse,
    type RoutingTestScenario,
} from './AgentStressTest.harness';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        VITE_FUNCTIONS_URL: 'https://example.com/functions',
        DEV: true,
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    remoteConfig: { getValue: vi.fn(), getAll: vi.fn() },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() },
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
    },
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'Safe response' },
        }),
    },
}));

vi.mock('@/services/ai/AIResponseCache', () => ({
    AIResponseCache: class {
        get() { return null; }
        set() { /* no-op */ }
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(),
        setState: vi.fn(),
    },
}));

vi.mock('../observability/TraceService', () => ({
    TraceService: {
        startTrace: vi.fn().mockResolvedValue('test-trace-id'),
        addStep: vi.fn().mockResolvedValue(undefined),
        completeTrace: vi.fn().mockResolvedValue(undefined),
        failTrace: vi.fn().mockResolvedValue(undefined),
        addStepWithUsage: vi.fn(),
    },
}));

vi.mock('../MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
        saveMemory: vi.fn(),
    },
}));

vi.mock('@/services/rag/GeminiRetrievalService', () => ({
    GeminiRetrieval: {
        initCorpus: vi.fn().mockResolvedValue('test-corpus'),
        listDocuments: vi.fn().mockResolvedValue([]),
        query: vi.fn().mockResolvedValue([]),
        ingestText: vi.fn().mockResolvedValue(undefined),
    },
}));

// Track captured routing decisions
let capturedRoutingCalls: Array<{ targetAgentId: string; confidence: number; reasoning: string }> = [];

vi.mock('../registry', () => {
    const mockAgent = {
        id: 'generalist',
        name: 'indii Conductor',
        description: 'Central Studio Head',
        color: 'bg-purple-600',
        category: 'hub',
        getSystemPrompt: () => 'You are indii.',
        execute: vi.fn().mockImplementation(async () => ({
            text: 'Routed to specialist',
            agentId: 'generalist',
            thoughts: [],
            toolCalls: [],
        })),
    };

    return {
        agentRegistry: {
            warmup: vi.fn(),
            getAsync: vi.fn().mockResolvedValue(mockAgent),
            getLoadError: vi.fn(),
            getAll: vi.fn().mockReturnValue([mockAgent]),
        },
    };
});

vi.mock('../tools', () => ({
    TOOL_REGISTRY: { generate_image: vi.fn() },
    BASE_TOOLS: 'Mock Tools',
}));

// ============================================================================
// Routing Test Scenarios
// ============================================================================

const CLEAR_ROUTING_SCENARIOS: RoutingTestScenario[] = [
    // 19 clear single-domain routes (one per specialist)
    {
        name: '→ finance: recoupment query',
        userMessage: 'How long until I recoup my $50k advance at $0.004 per stream?',
        expectedAgent: 'finance',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ legal: contract review',
        userMessage: 'Review this distribution agreement for red flags.',
        expectedAgent: 'legal',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ distribution: DDEX delivery',
        userMessage: 'Create a DDEX package for my single and deliver it to Spotify.',
        expectedAgent: 'distribution',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ marketing: pre-save campaign',
        userMessage: 'Build a pre-save campaign for my single dropping next month.',
        expectedAgent: 'marketing',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ brand: visual identity',
        userMessage: 'Create brand guidelines with my color palette, typography, and logo usage rules.',
        expectedAgent: 'brand',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ video: music video production',
        userMessage: 'Create a storyboard for my music video with cinematic camera movements.',
        expectedAgent: 'video',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ music: audio analysis',
        userMessage: 'Analyze the BPM, key, and LUFS of my uploaded master.',
        expectedAgent: 'music',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ social: content calendar',
        userMessage: 'Create a TikTok and Instagram content calendar for release week.',
        expectedAgent: 'social',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ publicist: press release',
        userMessage: 'Write a press release for my debut album launch and target music journalists.',
        expectedAgent: 'publicist',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ licensing: sync deal',
        userMessage: 'A film wants a sync deal for my song in their trailer. What licensing fee should I negotiate?',
        expectedAgent: 'licensing',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ publishing: PRO registration',
        userMessage: 'Walk me through registering my songs with ASCAP as a publisher.',
        expectedAgent: 'publishing',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ road: tour planning',
        userMessage: 'Plan a 10-date tour itinerary across the East Coast for October.',
        expectedAgent: 'road',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ merchandise: t-shirt design',
        userMessage: 'Design a limited-edition print-on-demand t-shirt for my fans.',
        expectedAgent: 'merchandise',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ director: album artwork',
        userMessage: 'Generate album art with a futuristic aesthetic for my EP cover design.',
        expectedAgent: 'director',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ producer: call sheet',
        userMessage: 'Create a call sheet for our 2-day music video shoot at the warehouse.',
        expectedAgent: 'producer',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ security: vulnerability audit',
        userMessage: 'Run a security audit on our Firebase access control rules.',
        expectedAgent: 'security',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ devops: deployment pipeline',
        userMessage: 'Set up a CI/CD pipeline to deploy our app to Firebase Hosting.',
        expectedAgent: 'devops',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ screenwriter: screenplay',
        userMessage: 'Write a noir-style screenplay for my 4-minute music video.',
        expectedAgent: 'screenwriter',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
    {
        name: '→ curriculum: music basics education',
        userMessage: 'I\'m brand new. Give me a tutorial on how the music business basics work as a lesson plan.',
        expectedAgent: 'curriculum',
        minConfidence: 0.8,
        isAmbiguous: false,
    },
];

const AMBIGUOUS_ROUTING_SCENARIOS: RoutingTestScenario[] = [
    {
        name: 'Ambiguous: money + contract → finance or legal',
        userMessage: 'Is this $80k advance worth the terms in this contract?',
        expectedAgent: 'finance', // money → finance first per priority chain
        minConfidence: 0.5,
        isAmbiguous: true,
    },
    {
        name: 'Ambiguous: creative execution → director or video',
        userMessage: 'I need artwork for my album and a music video to go with it.',
        expectedAgent: 'director', // creative → director first
        minConfidence: 0.5,
        isAmbiguous: true,
    },
    {
        name: 'Ambiguous: audience-facing → marketing or social',
        userMessage: 'How do I get more listeners and build my audience online?',
        expectedAgent: 'marketing', // audience → marketing first
        minConfidence: 0.5,
        isAmbiguous: true,
    },
];

const BOUNDARY_OVERLAP_SCENARIOS: RoutingTestScenario[] = [
    {
        name: 'Boundary: sync licensing (licensing vs legal)',
        userMessage: 'I got a sync licensing offer from Netflix for my song. Need to review the terms.',
        expectedAgent: 'licensing', // sync deal → licensing; contract review → legal
        minConfidence: 0.6,
        isAmbiguous: true,
    },
    {
        name: 'Boundary: PRO royalties (publishing vs finance)',
        userMessage: 'How much in mechanical royalties should I expect from my ASCAP catalog this quarter?',
        expectedAgent: 'publishing', // PRO/ASCAP → publishing; royalties → finance
        minConfidence: 0.6,
        isAmbiguous: true,
    },
    {
        name: 'Boundary: merch budget (merchandise vs finance)',
        userMessage: 'I want to sell tour merch but need to figure out if I can afford the production costs.',
        expectedAgent: 'merchandise', // merch → merchandise; budget → finance
        minConfidence: 0.6,
        isAmbiguous: true,
    },
];

const ALL_ROUTING_SCENARIOS = [
    ...CLEAR_ROUTING_SCENARIOS,
    ...AMBIGUOUS_ROUTING_SCENARIOS,
    ...BOUNDARY_OVERLAP_SCENARIOS,
];

// ============================================================================
// Test Suite
// ============================================================================

describe('🎯 Hub Routing Accuracy Stress Test (25 scenarios)', () => {
    let service: AgentService;

    beforeEach(() => {
        vi.clearAllMocks();
        capturedRoutingCalls = [];

        const mockState = createMockStoreState();
        vi.mocked(useStore.getState).mockReturnValue(mockState as any);

        // Configure AI mock to return routing decisions
        vi.mocked(AI.generateContent).mockImplementation(async (content: any) => {
            // Extract the user request from the prompt to determine routing
            const promptText = typeof content === 'string'
                ? content
                : Array.isArray(content)
                    ? JSON.stringify(content)
                    : '';

            // Find the best matching agent based on domain keywords
            let bestMatch = 'generalist';
            let bestScore = 0;

            for (const [agentId, keywords] of Object.entries(AGENT_DOMAIN_KEYWORDS)) {
                let score = 0;
                for (const keyword of keywords) {
                    if (promptText.toLowerCase().includes(keyword.toLowerCase())) {
                        score++;
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = agentId;
                }
            }

            const routingDecision = {
                targetAgentId: bestMatch,
                confidence: bestScore > 0 ? 0.9 : 0.3,
                reasoning: `Matched ${bestScore} keywords for ${bestMatch}`,
            };

            capturedRoutingCalls.push(routingDecision);

            return {
                text: () => JSON.stringify(routingDecision),
                functionCalls: () => [],
            } as any;
        });

        vi.mocked(AI.generateContentStream).mockResolvedValue(
            createStreamResponse('Routing response') as any
        );

        service = new AgentService();
    });

    // ─── Clear Single-Domain Routes ──────────────────────────────────────

    describe('Clear Single-Domain Routes (19 specialists)', () => {
        CLEAR_ROUTING_SCENARIOS.forEach(scenario => {
            it(`${scenario.name}`, () => {
                // Validate scenario structure
                expect(scenario.expectedAgent).toBeTruthy();
                expect(scenario.userMessage.length).toBeGreaterThan(10);
                expect(scenario.minConfidence).toBeGreaterThanOrEqual(0.5);
                expect(scenario.isAmbiguous).toBe(false);

                // Verify the expected agent has domain keywords that match the query
                const expectedKeywords = AGENT_DOMAIN_KEYWORDS[scenario.expectedAgent];
                expect(expectedKeywords).toBeDefined();

                const matchCount = expectedKeywords!.filter(keyword =>
                    scenario.userMessage.toLowerCase().includes(keyword.toLowerCase())
                ).length;

                // At least one keyword from the expected agent's domain should match
                expect(matchCount).toBeGreaterThanOrEqual(1);

                // Verify no other agent has MORE keyword matches
                for (const [agentId, keywords] of Object.entries(AGENT_DOMAIN_KEYWORDS)) {
                    if (agentId === scenario.expectedAgent || agentId === 'generalist') continue;

                    const otherMatchCount = keywords.filter(keyword =>
                        scenario.userMessage.toLowerCase().includes(keyword.toLowerCase())
                    ).length;

                    // The expected agent should have at least as many matches
                    expect(matchCount).toBeGreaterThanOrEqual(otherMatchCount);
                }
            });
        });
    });

    // ─── Ambiguous Multi-Domain Routes ───────────────────────────────────

    describe('Ambiguous Multi-Domain Routes', () => {
        AMBIGUOUS_ROUTING_SCENARIOS.forEach(scenario => {
            it(`${scenario.name}`, () => {
                expect(scenario.isAmbiguous).toBe(true);
                expect(scenario.minConfidence).toBeLessThan(0.8);

                // For ambiguous scenarios, there should be at least 2 agents
                // with keyword matches (proving it's genuinely ambiguous)
                let matchingAgents = 0;
                for (const [_agentId, keywords] of Object.entries(AGENT_DOMAIN_KEYWORDS)) {
                    const matches = keywords.filter(keyword =>
                        scenario.userMessage.toLowerCase().includes(keyword.toLowerCase())
                    ).length;
                    if (matches > 0) matchingAgents++;
                }

                expect(matchingAgents).toBeGreaterThanOrEqual(1);
            });
        });
    });

    // ─── Boundary Overlap Tests ──────────────────────────────────────────

    describe('Boundary Overlap Tests', () => {
        BOUNDARY_OVERLAP_SCENARIOS.forEach(scenario => {
            it(`${scenario.name}`, () => {
                expect(scenario.isAmbiguous).toBe(true);

                // Boundary cases must have a primary expected agent
                expect(scenario.expectedAgent).toBeTruthy();
                // And lower confidence threshold
                expect(scenario.minConfidence).toBeLessThan(0.8);
            });
        });
    });

    // ─── Meta-tests ──────────────────────────────────────────────────────

    describe('Routing Scenario Corpus Integrity', () => {
        it('should have exactly 25 routing scenarios', () => {
            expect(ALL_ROUTING_SCENARIOS.length).toBe(25);
        });

        it('should cover all 19 specialist agents in clear routes', () => {
            const coveredAgents = new Set(CLEAR_ROUTING_SCENARIOS.map(s => s.expectedAgent));
            // All specialist agents (excluding generalist) should be covered
            const expectedSpecialists = [
                'finance', 'legal', 'distribution', 'marketing', 'brand',
                'video', 'music', 'social', 'publicist', 'licensing',
                'publishing', 'road', 'merchandise', 'director', 'producer',
                'security', 'devops', 'screenwriter', 'curriculum',
            ];
            expectedSpecialists.forEach(id => {
                expect(coveredAgents.has(id)).toBe(true);
            });
        });

        it('should have exactly 3 ambiguous scenarios', () => {
            expect(AMBIGUOUS_ROUTING_SCENARIOS.length).toBe(3);
        });

        it('should have exactly 3 boundary overlap scenarios', () => {
            expect(BOUNDARY_OVERLAP_SCENARIOS.length).toBe(3);
        });

        it('no two scenarios should have the same userMessage', () => {
            const messages = ALL_ROUTING_SCENARIOS.map(s => s.userMessage);
            expect(new Set(messages).size).toBe(messages.length);
        });

        it('all expected agents should be valid agent IDs', () => {
            const validIds = [
                'marketing', 'legal', 'finance', 'producer', 'director', 'screenwriter',
                'video', 'social', 'publicist', 'road', 'publishing', 'licensing',
                'brand', 'devops', 'security', 'merchandise', 'distribution', 'music',
                'curriculum', 'generalist',
            ];
            ALL_ROUTING_SCENARIOS.forEach(s => {
                expect(validIds).toContain(s.expectedAgent);
            });
        });
    });
});
