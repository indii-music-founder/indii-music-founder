import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getCompiledHistory: vi.fn(),
    resolveContext: vi.fn(),
    assembleContext: vi.fn(),
    formatForPrompt: vi.fn(() => '<auto_recall/>'),
    retrieveFallback: vi.fn(),
    getPlansForProject: vi.fn(),
    searchProductSkillByIntentAsync: vi.fn(),
    getSkillForModule: vi.fn(() => undefined),
    getDirective: vi.fn(),
    formatDirectiveForPrompt: vi.fn(() => '<directive/>'),
    storeState: {
        isKnowledgeBaseEnabled: true,
        userProfile: { uid: 'user-1', preferences: {} },
        agentHistory: [
            { id: 'm1', role: 'user', text: 'Plan our album rollout for Friday' },
        ],
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mocks.storeState,
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-1' } },
}));

vi.mock('@/services/agent/components/ContextResolver', () => ({
    ContextResolver: class {
        resolveContext = mocks.resolveContext;
    },
}));

vi.mock('@/services/agent/components/HistoryManager', () => ({
    HistoryManager: class {
        getCompiledHistory = mocks.getCompiledHistory;
    },
}));

vi.mock('@/services/agent/memory/BigBrainEngine', () => ({
    bigBrainEngine: {
        assembleContext: mocks.assembleContext,
        formatForPrompt: mocks.formatForPrompt,
    },
}));

vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        retrieve: mocks.retrieveFallback,
    },
}));

vi.mock('@/services/agent/LivingPlanService', () => ({
    livingPlanService: {
        getPlansForProject: mocks.getPlansForProject,
    },
}));

vi.mock('@/services/agent/skills/ProductSkillRegistry', () => ({
    ProductSkillRegistry: {
        searchProductSkillByIntentAsync: mocks.searchProductSkillByIntentAsync,
        getSkillForModule: mocks.getSkillForModule,
        formatSkillForPrompt: vi.fn(() => ''),
    },
}));

vi.mock('@/services/agent/skills/ArtistDirectiveService', () => ({
    artistDirectiveService: {
        getDirective: mocks.getDirective,
        formatDirectiveForPrompt: mocks.formatDirectiveForPrompt,
    },
}));

vi.mock('@/services/agent/tools/IdeaParking', () => ({
    IdeaParkingService: {
        shouldAskForDialUpgrade: vi.fn(() => false),
        clearAmbitionPromptFlag: vi.fn(),
    },
}));

import { ContextPipeline } from '@/services/agent/components/ContextPipeline';

describe('ContextPipeline parallelism and timeout hygiene', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolveContext.mockResolvedValue({
            activeModule: 'creative',
            projectId: 'proj-1',
            chatHistory: [],
        });
        mocks.getPlansForProject.mockResolvedValue([]);
        mocks.searchProductSkillByIntentAsync.mockResolvedValue(undefined);
        mocks.getDirective.mockResolvedValue({ raw: 'Stay authentic' });
        mocks.retrieveFallback.mockResolvedValue([]);
    });

    it('starts BigBrain memory recall concurrently with conversation history compilation', async () => {
        let resolveHistory!: (v: { view: string; historicalSummary: string }) => void;
        let recallStartedWhileHistoryPending = false;

        mocks.getCompiledHistory.mockImplementation(
            () => new Promise((resolve) => { resolveHistory = resolve; }),
        );
        mocks.assembleContext.mockImplementation(async () => {
            recallStartedWhileHistoryPending = true;
            return {
                dailyLog: '',
                vaultFacts: '- fact 1',
                episodicRecall: '',
                alignmentRules: [],
                totalCharacters: 8,
                meta: { dailyLogEntries: 0, vaultFactCount: 1, episodicMatches: 0, alignmentRuleCount: 0, layerErrors: [] },
            };
        });

        const pipeline = new ContextPipeline();
        const buildPromise = pipeline.buildContext();

        // Flush microtasks so working context resolves and parallel reads launch
        await new Promise((r) => setTimeout(r, 20));
        expect(recallStartedWhileHistoryPending).toBe(true);
        expect(mocks.assembleContext).toHaveBeenCalledWith(
            'user-1',
            'creative',
            expect.stringContaining('Plan our album rollout'),
            'proj-1',
            undefined,
        );

        resolveHistory({ view: 'User: Plan our album rollout for Friday', historicalSummary: '' });
        const ctx = await buildPromise;
        expect(ctx.autoRecallBlock).toBe('<auto_recall/>');
    });

    it('does not chain a second fallback memory call when BigBrain recall times out', async () => {
        vi.useFakeTimers();
        try {
            mocks.getCompiledHistory.mockResolvedValue({
                view: 'User: Plan our album rollout for Friday',
                historicalSummary: '',
            });
            // Never resolves — triggers the 3.5s memory recall timeout
            mocks.assembleContext.mockImplementation(() => new Promise(() => undefined));

            const pipeline = new ContextPipeline();
            const buildPromise = pipeline.buildContext();

            await vi.advanceTimersByTimeAsync(4_000);
            const ctx = await buildPromise;

            expect(mocks.retrieveFallback).not.toHaveBeenCalled();
            expect(ctx.historyWarning).toBe('Saved memories are unavailable for this reply.');
        } finally {
            vi.useRealTimers();
        }
    });
});
