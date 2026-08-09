import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TouringService } from '@/services/touring/TouringService';
import { useTouring } from './useTouring';

const mocks = vi.hoisted(() => ({
    storeState: {
        userProfile: { id: 'user-1' } as { id: string } | null,
    },
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
}));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }));
vi.mock('@/services/touring/TouringService', () => ({
    TouringService: {
        subscribeToItineraries: vi.fn(),
        subscribeToEmergencyContacts: vi.fn(),
        saveItinerary: vi.fn(),
        updateItinerary: vi.fn(),
        saveEmergencyContact: vi.fn(),
        deleteEmergencyContact: vi.fn(),
    },
}));

const routeDraft = {
    tourName: 'Detroit route draft',
    stops: [],
    totalDistance: 'Not calculated',
};

describe('useTouring persistence contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.storeState.userProfile = { id: 'user-1' };
        vi.mocked(TouringService.subscribeToItineraries).mockImplementation((_userId, callback) => {
            callback([]);
            return vi.fn();
        });
        vi.mocked(TouringService.subscribeToEmergencyContacts).mockImplementation((_userId, callback) => {
            callback([]);
            return vi.fn();
        });
        vi.mocked(TouringService.saveItinerary).mockResolvedValue(undefined);
        vi.mocked(TouringService.updateItinerary).mockResolvedValue(undefined);
        vi.mocked(TouringService.saveEmergencyContact).mockResolvedValue(undefined);
        vi.mocked(TouringService.deleteEmergencyContact).mockResolvedValue(undefined);
    });

    it('persists a route draft for the authenticated user', async () => {
        const { result } = renderHook(() => useTouring());

        await act(async () => {
            await result.current.saveItinerary(routeDraft);
        });

        expect(TouringService.saveItinerary).toHaveBeenCalledWith({
            ...routeDraft,
            userId: 'user-1',
        });
    });

    it('propagates a Firestore save failure to the calling UI', async () => {
        const persistenceError = new Error('Firestore unavailable');
        vi.mocked(TouringService.saveItinerary).mockRejectedValueOnce(persistenceError);
        const { result } = renderHook(() => useTouring());

        await act(async () => {
            await expect(result.current.saveItinerary(routeDraft)).rejects.toBe(persistenceError);
        });
    });

    it.each([null, { id: 'pending' }])(
        'rejects itinerary writes without a resolved authenticated profile: %j',
        async (userProfile) => {
            mocks.storeState.userProfile = userProfile;
            const { result } = renderHook(() => useTouring());

            await act(async () => {
                await expect(result.current.saveItinerary(routeDraft)).rejects.toThrow(
                    'An authenticated user profile is required',
                );
            });
            expect(TouringService.saveItinerary).not.toHaveBeenCalled();
        },
    );

    it('propagates an itinerary update failure for a persisted stop', async () => {
        const persistenceError = new Error('update denied');
        vi.mocked(TouringService.subscribeToItineraries).mockImplementation((_userId, callback) => {
            callback([{
                id: 'itinerary-1',
                userId: 'user-1',
                tourName: 'Test tour',
                stops: [{
                    id: 'stop-1',
                    date: '2026-08-09',
                    city: 'Detroit',
                    venue: 'Test venue',
                    activity: 'Show',
                    notes: '',
                }],
                totalDistance: 'Not calculated',
            }]);
            return vi.fn();
        });
        vi.mocked(TouringService.updateItinerary).mockRejectedValueOnce(persistenceError);
        const { result } = renderHook(() => useTouring());

        await waitFor(() => expect(result.current.currentItinerary?.id).toBe('itinerary-1'));
        const updatedStop = {
            ...result.current.currentItinerary!.stops[0]!,
            city: 'Chicago',
        };

        await act(async () => {
            await expect(result.current.updateItineraryStop(0, updatedStop)).rejects.toBe(persistenceError);
        });
        expect(TouringService.updateItinerary).toHaveBeenCalledWith('itinerary-1', {
            stops: [expect.objectContaining({ id: 'stop-1', city: 'Chicago' })],
        });
    });

    it('propagates emergency-contact persistence failures', async () => {
        const persistenceError = new Error('contact write denied');
        vi.mocked(TouringService.saveEmergencyContact).mockRejectedValueOnce(persistenceError);
        const { result } = renderHook(() => useTouring());

        await act(async () => {
            await expect(result.current.saveEmergencyContact({
                name: 'Tour manager',
                phone: '555-0100',
                relationship: 'Manager',
            })).rejects.toBe(persistenceError);
        });
        expect(mocks.toast.error).toHaveBeenCalledWith('Failed to save emergency contact');
    });
});
