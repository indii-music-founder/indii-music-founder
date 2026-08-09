import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoadTools } from './RoadTools';

const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'user-1' } as { uid: string } | null },
    compileRouteDraft: vi.fn(),
    saveItinerary: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    functions: { kind: 'functions' },
    db: {},
}));
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => mocks.compileRouteDraft),
}));
vi.mock('@/services/touring/TouringService', () => ({
    TouringService: { saveItinerary: mocks.saveItinerary },
}));
vi.mock('@/services/touring/SetlistDraftService', () => ({
    setlistDraftService: { create: vi.fn() },
}));
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateStructuredData: vi.fn() },
}));
vi.mock('./MapsTools', () => ({ MapsTools: {} }));

const validRouteDraft = {
    status: 'route_draft',
    authority: 'user_inputs_only',
    stops: [
        { city: 'Detroit', date: '2026-08-20', venue: '', activity: 'Planning', type: 'Planning', notes: '' },
        { city: 'Chicago', date: '2026-08-21', venue: '', activity: 'Planning', type: 'Planning', notes: '' },
    ],
    limitations: [
        'Waypoints remain in the order entered by the user.',
        'Road routing, distance, drive time, traffic, venue availability, and budget are not calculated.',
    ],
};

describe('RoadTools draft_tour_itinerary production contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user-1' };
        mocks.compileRouteDraft.mockResolvedValue({ data: validRouteDraft });
        mocks.saveItinerary.mockResolvedValue(undefined);
    });

    it('uses the declared agent arguments, backend draft compiler, and real touring persistence contract', async () => {
        const result = await RoadTools.draft_tour_itinerary({
            tour_name: 'Midwest Draft',
            start_date: '2026-08-20',
            end_date: '2026-08-21',
            cities: ['Detroit', 'Chicago'],
        });

        expect(mocks.compileRouteDraft).toHaveBeenCalledWith({
            locations: ['Detroit', 'Chicago'],
            dates: { start: '2026-08-20', end: '2026-08-21' },
        });
        expect(mocks.saveItinerary).toHaveBeenCalledWith({
            userId: 'user-1',
            tourName: 'Midwest Draft',
            stops: validRouteDraft.stops,
            totalDistance: 'Not calculated',
        });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
            status: 'route_draft',
            authority: 'user_inputs_only',
            persisted: true,
            totalDistance: 'Not calculated',
        }));
        expect(result.message).toContain('not verified');
    });

    it('does not call the backend or persistence when unauthenticated', async () => {
        mocks.auth.currentUser = null;
        const result = await RoadTools.draft_tour_itinerary({
            tour_name: 'Midwest Draft',
            start_date: '2026-08-20',
            end_date: '2026-08-21',
            cities: ['Detroit', 'Chicago'],
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('AUTH_REQUIRED');
        expect(mocks.compileRouteDraft).not.toHaveBeenCalled();
        expect(mocks.saveItinerary).not.toHaveBeenCalled();
    });

    it('does not report success when the authenticated persistence write fails', async () => {
        mocks.saveItinerary.mockRejectedValueOnce(new Error('Firestore denied'));
        const result = await RoadTools.draft_tour_itinerary({
            tour_name: 'Midwest Draft',
            start_date: '2026-08-20',
            end_date: '2026-08-21',
            cities: ['Detroit', 'Chicago'],
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Firestore denied');
        expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
    });

    it('does not attempt persistence when the authenticated callable fails', async () => {
        mocks.compileRouteDraft.mockRejectedValueOnce(new Error('App Check rejected'));
        const result = await RoadTools.draft_tour_itinerary({
            tour_name: 'Midwest Draft',
            start_date: '2026-08-20',
            end_date: '2026-08-21',
            cities: ['Detroit', 'Chicago'],
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('App Check rejected');
        expect(mocks.saveItinerary).not.toHaveBeenCalled();
    });

    it('rejects a backend response that changes the submitted city order', async () => {
        mocks.compileRouteDraft.mockResolvedValueOnce({
            data: {
                ...validRouteDraft,
                stops: [...validRouteDraft.stops].reverse(),
            },
        });
        const result = await RoadTools.draft_tour_itinerary({
            tour_name: 'Midwest Draft',
            start_date: '2026-08-20',
            end_date: '2026-08-21',
            cities: ['Detroit', 'Chicago'],
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('UNTRUSTED_ROUTE_DRAFT');
        expect(mocks.saveItinerary).not.toHaveBeenCalled();
    });
});
