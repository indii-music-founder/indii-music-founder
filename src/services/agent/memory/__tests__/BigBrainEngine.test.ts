/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — vi.mock factories are hoisted. NO top-level variable references.
// ============================================================================

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc-ref' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    serverTimestamp: vi.fn(() => new Date()),
    Timestamp: { now: vi.fn(() => ({ toMillis: () => Date.now() })) },
}));

vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'AI-generated summary' },
        }),
    },
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: { TEXT: { FAST: 'gemini-3-flash-preview', COMPLEX: 'gemini-3-pro-preview' } },
}));

// Layer 4 — Captain's Log
vi.mock('../CaptainsLogService', () => ({
    captainsLogService: {
        getTodaysSummary: vi.fn().mockResolvedValue('Tasks (2): Generated art | Wrote press kit'),
    },
}));

// Layer 3 — Core Vault
vi.mock('../CoreVaultService', () => ({
    coreVaultService: {
        readVault: vi.fn().mockResolvedValue({
            summary: 'Test summary',
            facts: [
                { id: 'f1', fact: 'Artist name: Nova', category: 'artist_identity', status: 'active', accessCount: 1 },
            ],
        }),
    },
    ALL_VAULT_CATEGORIES: [
        'artist_identity', 'business_model', 'team', 'distribution', 'legal',
        'financial', 'technical', 'preferences', 'goals', 'contacts',
    ],
}));

// Layer 2 — Memory Service
vi.mock('../../MemoryService', () => ({
    memoryService: {
        retrieveRelevantMemories: vi.fn().mockResolvedValue([
            'User prefers warm color palettes',
            'Previous session discussed album sequencing',
        ]),
    },
}));

// User Memory Service
vi.mock('../../UserMemoryService', () => ({
    userMemoryService: {
        searchMemories: vi.fn().mockResolvedValue([
            { memory: { content: 'Always use formal language' } },
            { memory: { content: 'Prefer dark mode' } },
        ]),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { bigBrainEngine } from '../BigBrainEngine';
import { captainsLogService } from '../CaptainsLogService';
import { coreVaultService } from '../CoreVaultService';

// ============================================================================
// TESTS
// ============================================================================

describe('BigBrainEngine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default mock implementations after clearAllMocks
        vi.mocked(captainsLogService.getTodaysSummary).mockResolvedValue(
            'Tasks (2): Generated art | Wrote press kit'
        );
        vi.mocked(coreVaultService.readVault).mockResolvedValue({
            summary: 'Test summary',
            facts: [
                { id: 'f1', fact: 'Artist name: Nova', category: 'artist_identity', status: 'active', accessCount: 1, timestamp: new Date().toISOString(), source: 'user' as const },
            ],
        });
    });

    describe('assembleContext', () => {
        it('should assemble context from all 4 layers in parallel', async () => {
            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'creative-director',
                'Help me design album art',
                'project-123'
            );

            expect(context.dailyLog).toContain('Tasks (2)');
            expect(context.vaultFacts).toContain('Artist name: Nova');
            expect(context.episodicRecall).toContain('warm color palettes');
            expect(context.alignmentRules).toContain('Always use formal language');
            expect(context.meta.layerErrors).toHaveLength(0);
        });

        it('should survive a layer failure without blocking other layers', async () => {
            vi.mocked(captainsLogService.getTodaysSummary).mockRejectedValueOnce(
                new Error('Firestore down')
            );

            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'agent0',
                'What happened today?'
            );

            // Daily log failed, but other layers should still work
            expect(context.dailyLog).toBe('');
            expect(context.vaultFacts).toContain('Artist name: Nova');
            expect(context.meta.layerErrors).toHaveLength(1);
            expect(context.meta.layerErrors[0]).toContain('dailyLog');
        });

        it('should use targeted vault categories for the agent', async () => {
            await bigBrainEngine.assembleContext(
                'user-1',
                'distribution',
                'Check my distributor status'
            );

            // Distribution agent should query distribution, legal, financial categories
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'distribution');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'legal');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'financial');
        });

        it('should use defaults for unknown agent IDs', async () => {
            await bigBrainEngine.assembleContext(
                'user-1',
                'unknown-agent',
                'Hello'
            );

            // Falls back to artist_identity, preferences, goals
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'artist_identity');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'preferences');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'goals');
        });

        it('should report totalCharacters correctly', async () => {
            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'agent0',
                'Hello',
                'project-1'
            );

            expect(context.totalCharacters).toBeGreaterThan(0);
            const manualTotal =
                context.dailyLog.length +
                context.vaultFacts.length +
                context.episodicRecall.length +
                context.alignmentRules.join('').length;
            expect(context.totalCharacters).toBe(manualTotal);
        });
    });

    describe('formatForPrompt', () => {
        it('should produce valid XML block with memory sections', async () => {
            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'agent0',
                'Test',
                'project-1'
            );

            const prompt = bigBrainEngine.formatForPrompt(context);

            expect(prompt).toContain('<auto_recall>');
            expect(prompt).toContain('</auto_recall>');
            expect(prompt).toContain('<daily_context>');
            expect(prompt).toContain('<authoritative_facts>');
            expect(prompt).toContain('<cross_session_recall>');
            // alignment rules are handled by AgentPromptBuilder, NOT here
            expect(prompt).not.toContain('<user_specific_alignment>');
        });

        it('should return empty string when all layers are empty', () => {
            const emptyContext = {
                dailyLog: '',
                vaultFacts: '',
                episodicRecall: '',
                alignmentRules: [],
                totalCharacters: 0,
                meta: {
                    dailyLogEntries: 0,
                    vaultFactCount: 0,
                    episodicMatches: 0,
                    alignmentRuleCount: 0,
                    layerErrors: [],
                },
            };

            const prompt = bigBrainEngine.formatForPrompt(emptyContext);

            expect(prompt).toBe('');
        });

        it('should handle partial context (only vault facts)', () => {
            const partialContext = {
                dailyLog: '',
                vaultFacts: '- [artist_identity] Name is Nova',
                episodicRecall: '',
                alignmentRules: [],
                totalCharacters: 35,
                meta: {
                    dailyLogEntries: 0,
                    vaultFactCount: 1,
                    episodicMatches: 0,
                    alignmentRuleCount: 0,
                    layerErrors: [],
                },
            };

            const prompt = bigBrainEngine.formatForPrompt(partialContext);

            expect(prompt).toContain('<auto_recall>');
            expect(prompt).toContain('<authoritative_facts>');
            expect(prompt).not.toContain('<daily_context>');
            expect(prompt).not.toContain('<cross_session_recall>');
        });
    });
});
