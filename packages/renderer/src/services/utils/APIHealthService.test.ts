// Legacy structural-only probes; no deployed health or service availability proof.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiHealthService } from './APIHealthService';

const mockGetDoc = vi.fn();
const mockHealthFetch = vi.fn();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'health-test-user' } },
    db: {},
    functions: { app: { options: { projectId: 'probe-contract' } } },
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
    getDocFromServer: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        getCircuitStates: vi.fn(() => ({ gemini: 'closed' })),
    },
}));

describe('APIHealthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123456');
        apiHealthService.stopMonitoring();
        mockHealthFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
        global.fetch = vi.fn((url) => String(url).includes('/healthCheck')
            ? mockHealthFetch()
            : Promise.resolve({ ok: true, status: 200 } as Response));
    });

    it('reports healthy when Firestore, Functions, Gemini, Auth, and Stripe are reachable', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });


        const statuses = await apiHealthService.checkAll();

        expect(statuses.firestore?.status).toBe('healthy');
        expect(statuses.firebase_auth?.status).toBe('healthy');
        expect(statuses.functions?.status).toBe('healthy');
        expect(statuses.gemini_api?.status).toBe('healthy');
    });

    it('reports offline when Firestore read fails or times out', async () => {
        mockGetDoc.mockRejectedValueOnce(new Error('Network transport error'));


        const statuses = await apiHealthService.checkAll();

        expect(statuses.firestore?.status).toBe('offline');
        expect(statuses.firestore?.error).toContain('Network transport error');
    });

    it('reports offline when Functions endpoint is completely unreachable', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });
        mockHealthFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

        const statuses = await apiHealthService.checkAll();

        expect(statuses.functions?.status).toBe('offline');
        expect(statuses.functions?.error).toContain('Failed to fetch');
    });

    it('reports offline when Stripe network probe fails', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });


        global.fetch = vi.fn((url) => String(url).includes('/healthCheck')
            ? mockHealthFetch()
            : Promise.reject(new Error('Stripe timeout')));

        const statuses = await apiHealthService.checkAll();

        expect(statuses.stripe?.status).toBe('offline');
        expect(statuses.stripe?.error).toContain('Stripe endpoint unreachable');
    });
});
