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

// Layer 2 — Always-On Memory Engine
vi.mock('../AlwaysOnMemoryEngine', () => ({
    alwaysOnMemoryEngine: {
        getAllMemories: vi.fn().mockResolvedValue([
            { id: 'm1', content: 'Recent discussion about album sequencing', summary: 'Album sequencing conversation', tier: 'working', category: 'interaction', createdAt: Date.now(), topics: [] },
        ]),
    },
}));

// Layer (User) — Memory Bank (Mem0)
vi.mock('../MemoryBankService', () => ({
    memoryBankService: {
        searchMemories: vi.fn().mockResolvedValue([
            { id: 'bank-1', memory: 'User prefers warm color palettes' },
            { id: 'bank-2', memory: 'Always use formal language' },
        ]),
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { bigBrainEngine } from '../BigBrainEngine';
import { captainsLogService } from '../CaptainsLogService';
import { coreVaultService } from '../CoreVaultService';
import { alwaysOnMemoryEngine } from '../AlwaysOnMemoryEngine';
import { memoryBankService } from '../MemoryBankService';

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
        vi.mocked(alwaysOnMemoryEngine.getAllMemories).mockResolvedValue([
            { id: 'm1', content: 'Recent discussion about album sequencing', summary: 'Album sequencing conversation', tier: 'working', category: 'interaction', createdAt: Date.now(), topics: [] } as any,
        ]);
        vi.mocked(memoryBankService.searchMemories).mockResolvedValue([
            { id: 'bank-1', memory: 'User prefers warm color palettes' } as any,
            { id: 'bank-2', memory: 'Always use formal language' } as any,
        ]);
    });

    describe('assembleContext', () => {
        it('should assemble context from all layers in parallel', async () => {
            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'creative-director',
                'Help me design album art'
            );

            expect(context.dailyLog).toContain('Tasks (2)');
            expect(context.vaultFacts).toContain('Artist name: Nova');
            expect(context.episodicRecall).toContain('warm color palettes'); // from memoryBankService
            expect(context.episodicRecall).toContain('Album sequencing'); // from alwaysOnMemoryEngine
            expect(context.alignmentRules).toContain('Always use formal language');
            expect(context.meta.layerErrors).toHaveLength(0);
        });

        it('should survive a layer failure without blocking other layers', async () => {
            vi.mocked(captainsLogService.getTodaysSummary).mockRejectedValueOnce(
                new Error('Firestore down')
            );

            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'generalist',
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
                'creative-director',
                'Help me design album art'
            );

            // Creative director should query artist_identity, preferences, technical, goals
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'artist_identity');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'preferences');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'technical');
            expect(coreVaultService.readVault).toHaveBeenCalledWith('user-1', 'goals');
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
    });

    describe('formatForPrompt', () => {
        it('should produce valid XML block with memory sections', async () => {
            const context = await bigBrainEngine.assembleContext(
                'user-1',
                'generalist',
                'Test'
            );

            const prompt = bigBrainEngine.formatForPrompt(context);

            expect(prompt).toContain('<auto_recall>');
            expect(prompt).toContain('</auto_recall>');
            expect(prompt).toContain('<daily_context>');
            expect(prompt).toContain('<authoritative_facts>');
            expect(prompt).toContain('<cross_session_recall>');
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

            const prompt = bigBrainEngine.formatForPrompt(emptyContext as any);

            expect(prompt).toBe('');
        });
    });
});
