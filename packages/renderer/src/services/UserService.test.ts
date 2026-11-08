import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './UserService';

const {
    mockDoc,
    mockGetDoc,
    mockUpdateDoc,
    mockSetDoc,
} = vi.hoisted(() => ({
    mockDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockSetDoc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'user-alice' } },
}));

vi.mock('firebase/firestore', () => ({
    doc: mockDoc,
    getDoc: mockGetDoc,
    updateDoc: mockUpdateDoc,
    setDoc: mockSetDoc,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
}));

describe('UserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getPublicProfile', () => {
        it('fetches public profile projection and social stats for a user', async () => {
            mockDoc.mockImplementation((_db, coll, id) => `${coll}/${id}`);
            mockGetDoc.mockImplementation(async (ref: string) => {
                if (ref === 'public_profiles/user-bob') {
                    return {
                        exists: () => true,
                        data: () => ({
                            displayName: 'Bob The Producer',
                            bio: 'Crafting beats',
                            photoURL: 'https://cdn.example.com/bob.jpg',
                            accountType: 'artist',
                        }),
                    };
                }
                if (ref === 'social_stats/user-bob') {
                    return {
                        exists: () => true,
                        data: () => ({
                            followers: 120,
                            following: 45,
                            posts: 10,
                            drops: 2,
                        }),
                    };
                }
                return { exists: () => false, data: () => ({}) };
            });

            const profile = await UserService.getPublicProfile('user-bob');
            expect(profile).not.toBeNull();
            expect(profile?.displayName).toBe('Bob The Producer');
            expect(profile?.bio).toBe('Crafting beats');
            expect(profile?.photoURL).toBe('https://cdn.example.com/bob.jpg');
            expect(profile?.accountType).toBe('artist');
            expect(profile?.socialStats).toEqual({
                followers: 120,
                following: 45,
                posts: 10,
                drops: 2,
            });
        });

        it('returns minimal public projection if document does not exist yet', async () => {
            mockDoc.mockImplementation((_db, coll, id) => `${coll}/${id}`);
            mockGetDoc.mockResolvedValue({
                exists: () => false,
                data: () => ({}),
            });

            const profile = await UserService.getPublicProfile('user-unknown');
            expect(profile).not.toBeNull();
            expect(profile?.id).toBe('user-unknown');
            expect(profile?.displayName).toBeNull();
            expect(profile?.socialStats).toEqual({
                followers: 0,
                following: 0,
                posts: 0,
                drops: 0,
            });
        });
    });

    describe('getUserProfile', () => {
        it('returns user document on owner read', async () => {
            mockDoc.mockImplementation((_db, coll, id) => `${coll}/${id}`);
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    id: 'user-alice',
                    uid: 'user-alice',
                    displayName: 'Alice Artist',
                    email: 'alice@example.com',
                }),
            });

            const profile = await UserService.getUserProfile('user-alice');
            expect(profile?.displayName).toBe('Alice Artist');
            expect(profile?.email).toBe('alice@example.com');
        });

        it('falls back to getPublicProfile if private users document read returns permission-denied', async () => {
            mockDoc.mockImplementation((_db, coll, id) => `${coll}/${id}`);
            const permissionError = new Error('Missing or insufficient permissions');
            (permissionError as any).code = 'permission-denied';

            mockGetDoc.mockImplementation(async (ref: string) => {
                if (ref === 'users/user-bob') {
                    throw permissionError;
                }
                if (ref === 'public_profiles/user-bob') {
                    return {
                        exists: () => true,
                        data: () => ({
                            displayName: 'Bob The Producer',
                            bio: 'Public bio only',
                        }),
                    };
                }
                return { exists: () => false, data: () => ({}) };
            });

            const profile = await UserService.getUserProfile('user-bob');
            expect(profile).not.toBeNull();
            expect(profile?.displayName).toBe('Bob The Producer');
            expect(profile?.bio).toBe('Public bio only');
            // Private email should not be present
            expect((profile as any).email).toBeUndefined();
        });
    });

    describe('updateProfile', () => {
        it('updates user doc and projects public fields to public_profiles', async () => {
            mockDoc.mockImplementation((_db, coll, id) => `${coll}/${id}`);
            mockUpdateDoc.mockResolvedValueOnce(undefined);
            mockSetDoc.mockResolvedValueOnce(undefined);

            await UserService.updateProfile('user-alice', {
                displayName: 'Alice In Wonder',
                bio: 'Electronic artist',
                accountType: 'artist',
            });

            expect(mockUpdateDoc).toHaveBeenCalledWith(
                'users/user-alice',
                expect.objectContaining({
                    displayName: 'Alice In Wonder',
                    bio: 'Electronic artist',
                    accountType: 'artist',
                    updatedAt: 'MOCK_TIMESTAMP',
                })
            );

            expect(mockSetDoc).toHaveBeenCalledWith(
                'public_profiles/user-alice',
                expect.objectContaining({
                    id: 'user-alice',
                    uid: 'user-alice',
                    userId: 'user-alice',
                    displayName: 'Alice In Wonder',
                    bio: 'Electronic artist',
                    accountType: 'artist',
                    updatedAt: 'MOCK_TIMESTAMP',
                }),
                { merge: true }
            );
        });
    });
});
