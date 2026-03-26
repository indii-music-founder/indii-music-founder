/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — Must be defined before module imports
// ============================================================================

const mockDocData: Record<string, unknown> = {};
let mockDocExists = false;

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc-ref' })),
    getDoc: vi.fn(() => Promise.resolve({
        exists: () => mockDocExists,
        data: () => mockDocData,
    })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    serverTimestamp: vi.fn(() => new Date()),
    Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() })),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: { text: () => 'Test summary of artist_identity facts.' },
        }),
    },
}));

vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        TEXT: { FAST: 'gemini-3-flash-preview', COMPLEX: 'gemini-3-pro-preview' },
    },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { coreVaultService, ALL_VAULT_CATEGORIES } from '../CoreVaultService';
import { getDoc, setDoc, updateDoc } from 'firebase/firestore';

// ============================================================================
// TESTS
// ============================================================================

describe('CoreVaultService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDocExists = false;
        Object.keys(mockDocData).forEach(k => delete mockDocData[k]);
    });

    describe('readVault', () => {
        it('should return empty facts when vault category does not exist', async () => {
            mockDocExists = false;

            const result = await coreVaultService.readVault('user-1', 'artist_identity');

            expect(result.facts).toEqual([]);
            expect(result.summary).toBe('');
            // Should attempt to create the document
            expect(setDoc).toHaveBeenCalled();
        });

        it('should return only active facts', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'artist_identity',
                summary: 'Test summary',
                items: [
                    { id: 'fact-1', fact: 'Active fact', status: 'active', accessCount: 0 },
                    { id: 'fact-2', fact: 'Old fact', status: 'superseded', accessCount: 5 },
                    { id: 'fact-3', fact: 'Another active', status: 'active', accessCount: 2 },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const result = await coreVaultService.readVault('user-1', 'artist_identity');

            expect(result.facts).toHaveLength(2);
            expect(result.facts.every(f => f.status === 'active')).toBe(true);
            expect(result.summary).toBe('Test summary');
        });

        it('should increment access counts on active facts', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'preferences',
                summary: '',
                items: [
                    { id: 'f1', fact: 'Likes jazz', status: 'active', accessCount: 3 },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            await coreVaultService.readVault('user-1', 'preferences');

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    items: expect.arrayContaining([
                        expect.objectContaining({ id: 'f1', accessCount: 4 }),
                    ]),
                })
            );
        });
    });

    describe('addFact', () => {
        it('should add a new fact and return its ID', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'goals',
                summary: '',
                items: [],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const factId = await coreVaultService.addFact(
                'user-1',
                'goals',
                'Release 10 tracks this year',
                'user'
            );

            expect(factId).toMatch(/^vault_goals_/);
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            fact: 'Release 10 tracks this year',
                            source: 'user',
                            status: 'active',
                        }),
                    ]),
                })
            );
        });

        it('should skip exact duplicate facts (case-insensitive)', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'artist_identity',
                summary: '',
                items: [
                    { id: 'existing-1', fact: 'Artist name is Nova', status: 'active', accessCount: 0 },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const factId = await coreVaultService.addFact(
                'user-1',
                'artist_identity',
                'ARTIST NAME IS NOVA',
                'agent'
            );

            expect(factId).toBe('existing-1');
            expect(updateDoc).not.toHaveBeenCalled();
        });

        it('should mark the old fact as superseded when supersedes option is provided', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'financial',
                summary: '',
                items: [
                    { id: 'old-fact', fact: 'Revenue target: $10k', status: 'active', accessCount: 2 },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const newId = await coreVaultService.addFact(
                'user-1',
                'financial',
                'Revenue target: $50k',
                'user',
                { supersedes: 'old-fact' }
            );

            expect(newId).toMatch(/^vault_financial_/);
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    items: expect.arrayContaining([
                        expect.objectContaining({ id: 'old-fact', status: 'superseded', supersededBy: newId }),
                        expect.objectContaining({ fact: 'Revenue target: $50k', supersedes: 'old-fact' }),
                    ]),
                })
            );
        });
    });

    describe('supersedeFact', () => {
        it('should delegate to addFact with supersedes option', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'team',
                summary: '',
                items: [
                    { id: 'tm-1', fact: 'Manager: Alice', status: 'active', accessCount: 0 },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const newId = await coreVaultService.supersedeFact(
                'user-1',
                'team',
                'tm-1',
                'Manager: Bob',
                'user'
            );

            expect(newId).toMatch(/^vault_team_/);
        });
    });

    describe('getFactHistory', () => {
        it('should walk the supersession chain backwards', async () => {
            mockDocExists = true;
            Object.assign(mockDocData, {
                category: 'financial',
                summary: '',
                items: [
                    { id: 'v1', fact: 'Split 50/50', status: 'superseded', supersededBy: 'v2' },
                    { id: 'v2', fact: 'Split 60/40', status: 'superseded', supersedes: 'v1', supersededBy: 'v3' },
                    { id: 'v3', fact: 'Split 70/30', status: 'active', supersedes: 'v2' },
                ],
                lastUpdated: null,
                lastSummaryGenerated: null,
            });

            const chain = await coreVaultService.getFactHistory('user-1', 'financial', 'v3');

            expect(chain).toHaveLength(3);
            expect(chain[0]!.id).toBe('v3');
            expect(chain[1]!.id).toBe('v2');
            expect(chain[2]!.id).toBe('v1');
        });
    });

    describe('ALL_VAULT_CATEGORIES', () => {
        it('should contain all 10 categories', () => {
            expect(ALL_VAULT_CATEGORIES).toHaveLength(10);
            expect(ALL_VAULT_CATEGORIES).toContain('artist_identity');
            expect(ALL_VAULT_CATEGORIES).toContain('business_model');
            expect(ALL_VAULT_CATEGORIES).toContain('distribution');
            expect(ALL_VAULT_CATEGORIES).toContain('financial');
            expect(ALL_VAULT_CATEGORIES).toContain('contacts');
        });
    });
});
