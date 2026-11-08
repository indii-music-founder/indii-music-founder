import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiHealthService } from './APIHealthService';

const mockGetDoc = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'health-test-user' } },
    db: {},
    functions: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
    getDoc: (...args: any[]) => mockGetDoc(...args),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => mockHttpsCallable),
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
    });

    it('reports healthy when Firestore, Functions, Gemini, Auth, and Stripe are reachable', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });
        mockHttpsCallable.mockResolvedValueOnce({ data: { status: 'ok' } });

        // Mock global fetch for Stripe healthcheck
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
        });

        const statuses = await apiHealthService.checkAll();

        expect(statuses.firestore?.status).toBe('healthy');
        expect(statuses.firebase_auth?.status).toBe('healthy');
        expect(statuses.functions?.status).toBe('healthy');
        expect(statuses.gemini_api?.status).toBe('healthy');
    });

    it('reports offline when Firestore read fails or times out', async () => {
        mockGetDoc.mockRejectedValueOnce(new Error('Network transport error'));
        mockHttpsCallable.mockResolvedValueOnce({ data: { status: 'ok' } });

        const statuses = await apiHealthService.checkAll();

        expect(statuses.firestore?.status).toBe('offline');
        expect(statuses.firestore?.error).toContain('Network transport error');
    });

    it('reports offline when Functions endpoint is completely unreachable', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });
        mockHttpsCallable.mockRejectedValueOnce(new Error('Failed to fetch'));

        const statuses = await apiHealthService.checkAll();

        expect(statuses.functions?.status).toBe('offline');
        expect(statuses.functions?.error).toContain('Failed to fetch');
    });

    it('reports offline when Stripe network probe fails', async () => {
        mockGetDoc.mockResolvedValueOnce({ exists: () => true });
        mockHttpsCallable.mockResolvedValueOnce({ data: { status: 'ok' } });

        global.fetch = vi.fn().mockRejectedValueOnce(new Error('Stripe timeout'));

        const statuses = await apiHealthService.checkAll();

        expect(statuses.stripe?.status).toBe('offline');
        expect(statuses.stripe?.error).toContain('Stripe endpoint unreachable');
    });
});
