
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalService } from './LegalService';
import { useStore } from '@/core/store';
import { ContractStatus } from '@/modules/legal/types';
import { addDoc, getDocs } from 'firebase/firestore';

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user', email: 'test@example.com' } },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
    updateDoc: vi.fn(),
    Timestamp: { now: vi.fn() }
}));

vi.mock('@/core/store', () => ({
    useStore: { getState: vi.fn() }
}));

describe('LegalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore.getState).mockReturnValue({ userProfile: { id: 'test-user-id' } } as unknown as ReturnType<typeof useStore.getState>);
    });

    // ── Contracts ──────────────────────────────────────────────────────────

    it('saves a contract draft and returns the doc id', async () => {
        const id = await LegalService.saveContract({
            title: 'Test NDA', type: 'NDA', parties: ['Me', 'You'],
            content: '# NDA', status: ContractStatus.DRAFT
        });
        expect(id).toBe('mock-doc-id');
        expect(addDoc).toHaveBeenCalledOnce();
    });

    it('throws when saving a contract without authentication', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ userProfile: null } as unknown as ReturnType<typeof useStore.getState>);
        await expect(LegalService.saveContract({} as unknown as Parameters<typeof LegalService.saveContract>[0])).rejects.toThrow('User not authenticated');
    });

    it('returns empty array for getContracts when unauthenticated', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ userProfile: null } as unknown as ReturnType<typeof useStore.getState>);
        const result = await LegalService.getContracts();
        expect(result).toEqual([]);
    });

    it('returns mapped contracts from getContracts', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [
                { id: 'c-1', data: () => ({ title: 'NDA', type: 'NDA', parties: [], content: '', status: 'draft' }) }
            ]
        } as unknown as import('firebase/firestore').QuerySnapshot<import('firebase/firestore').DocumentData>);
        const contracts = await LegalService.getContracts();
        expect(contracts).toHaveLength(1);
        expect(contracts[0]!.id).toBe('c-1');
        expect(contracts[0]!.title).toBe('NDA');
    });

    // ── Analysis persistence ───────────────────────────────────────────────

    it('saveAnalysis persists to Firestore and returns a doc id', async () => {
        const id = await LegalService.saveAnalysis({
            fileName: 'contract.pdf',
            score: 85,
            summary: 'Looks standard.',
            risks: ['Non-compete clause'],
            analyzedAt: '2026-03-16T00:00:00.000Z',
        });
        expect(id).toBe('mock-doc-id');
        expect(addDoc).toHaveBeenCalledOnce();
        // Verify the payload includes savedAt (serverTimestamp)
        const [, payload] = vi.mocked(addDoc).mock.calls[0] as unknown as [unknown, { fileName: string, score: number, savedAt: string }];
        expect(payload.fileName).toBe('contract.pdf');
        expect(payload.score).toBe(85);
        expect(payload.savedAt).toBe('mock-timestamp');
    });

    it('saveAnalysis silently returns empty string when unauthenticated', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ userProfile: null } as unknown as ReturnType<typeof useStore.getState>);
        const id = await LegalService.saveAnalysis({
            fileName: 'contract.pdf', score: 50, summary: 'ok',
            risks: [], analyzedAt: new Date().toISOString(),
        });
        expect(id).toBe('');
        expect(addDoc).not.toHaveBeenCalled();
    });

    it('getAnalyses returns empty array when unauthenticated', async () => {
        vi.mocked(useStore.getState).mockReturnValue({ userProfile: null } as unknown as ReturnType<typeof useStore.getState>);
        const result = await LegalService.getAnalyses();
        expect(result).toEqual([]);
    });

    it('getAnalyses returns mapped analysis records from Firestore', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [
                { id: 'a-1', data: () => ({ fileName: 'deal.pdf', score: 72, summary: 'Good deal.', risks: ['IP clause'], analyzedAt: '2026-03-10T00:00:00.000Z' }) },
                { id: 'a-2', data: () => ({ fileName: 'mgmt.pdf', score: 90, summary: 'Excellent.', risks: [], analyzedAt: '2026-03-15T00:00:00.000Z' }) }
            ]
        } as unknown as import('firebase/firestore').QuerySnapshot<import('firebase/firestore').DocumentData>);
        const analyses = await LegalService.getAnalyses();
        expect(analyses).toHaveLength(2);
        expect(analyses[0]!.id).toBe('a-1');
        expect(analyses[0]!.fileName).toBe('deal.pdf');
        expect(analyses[0]!.score).toBe(72);
        expect(analyses[1]!.score).toBe(90);
    });
});

