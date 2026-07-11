import { describe, it, expect, vi, beforeEach } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RosterService, RosterItemSchema } from './RosterService';
import { Venue } from '../types';
import { ZodError } from 'zod';

// Mock dependencies
const {
    mockSetDoc,
    mockDoc,
    mockServerTimestamp
} = vi.hoisted(() => {
    return {
        mockSetDoc: vi.fn(),
        mockDoc: vi.fn((db, path) => `MOCK_DOC_REF:${path}`),
        mockServerTimestamp: vi.fn(() => 'MOCK_TIMESTAMP')
    };
});

vi.mock('firebase/firestore', () => ({
    setDoc: mockSetDoc,
    doc: mockDoc,
    serverTimestamp: mockServerTimestamp
}));

vi.mock('@/services/firebase', () => ({
    db: 'MOCK_DB'
}));

// ISSUE-901: Mock the Zustand store to return a real user
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            user: { uid: 'test-user-123' }
        }))
    }
}));

describe('RosterService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validVenue: Venue = {
        id: 'venue-123',
        name: 'The Fillmore',
        city: 'San Francisco',
        capacity: 1000,
        genres: ['rock', 'pop'],
        status: 'active'
    };

    describe('addToRoster', () => {
        it('should add a valid venue to the roster successfully with authenticated user', async () => {
            // ISSUE-901: Now uses test-user-123 instead of dev-user
            await RosterService.addToRoster(validVenue);

            expect(mockDoc).toHaveBeenCalledWith('MOCK_DB', `users/test-user-123/roster/${validVenue.id}`);
            expect(mockSetDoc).toHaveBeenCalledWith(
                `MOCK_DOC_REF:users/test-user-123/roster/${validVenue.id}`,
                {
                    venueId: validVenue.id,
                    name: validVenue.name,
                    city: validVenue.city,
                    status: validVenue.status,
                    addedAt: 'MOCK_TIMESTAMP'
                }
            );
        });

        it('should throw error when user is not authenticated', async () => {
            const { useStore } = await import('@/core/store');
            vi.mocked(useStore).getState.mockReturnValueOnce({ user: null } as any);

            await expect(RosterService.addToRoster(validVenue)).rejects.toThrow(
                'Cannot add to roster: User is not authenticated'
            );
            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('should throw Zod validation error if venue data is invalid', async () => {
            const invalidVenue = { ...validVenue, name: '' } as Venue; // name cannot be empty

            await expect(RosterService.addToRoster(invalidVenue)).rejects.toThrow(ZodError);
            expect(mockSetDoc).not.toHaveBeenCalled();
        });

        it('should handle optional status correctly', async () => {
            const venueNoStatus = { ...validVenue };
            venueNoStatus.status = undefined as any;
            const testVenue = venueNoStatus as unknown as Venue;

            await RosterService.addToRoster(testVenue);

            expect(mockSetDoc).toHaveBeenCalledWith(
                `MOCK_DOC_REF:users/test-user-123/roster/${validVenue.id}`,
                {
                    venueId: validVenue.id,
                    name: validVenue.name,
                    city: validVenue.city,
                    status: undefined,
                    addedAt: 'MOCK_TIMESTAMP'
                }
            );
        });

        it('should pass unexpected fields implicitly if schema allows (or strip if strict)', async () => {
            const venueExtra = { ...validVenue, someExtraField: 'ignore-me' } as unknown as Venue;

            await RosterService.addToRoster(venueExtra);

             expect(mockSetDoc).toHaveBeenCalledWith(
                `MOCK_DOC_REF:users/test-user-123/roster/${validVenue.id}`,
                {
                    venueId: validVenue.id,
                    name: validVenue.name,
                    city: validVenue.city,
                    status: validVenue.status,
                    addedAt: 'MOCK_TIMESTAMP'
                }
            );
        });

        it('should handle Firestore write failures appropriately', async () => {
            mockSetDoc.mockRejectedValueOnce(new Error('Firestore connection failed'));

            await expect(RosterService.addToRoster(validVenue)).rejects.toThrow('Firestore connection failed');
        });

        it('should handle attempting to add a venue that is already in the roster (simulate overwrite)', async () => {
            // Firestore setDoc effectively overwrites or merges data.
            // Since there's no transaction or conditional check in addToRoster, it just writes to the path.
            // We verify that it behaves identically.
            await RosterService.addToRoster(validVenue);

            expect(mockSetDoc).toHaveBeenCalledTimes(1);

            // Second call
            await RosterService.addToRoster(validVenue);
            expect(mockSetDoc).toHaveBeenCalledTimes(2);
        });
    });
});
