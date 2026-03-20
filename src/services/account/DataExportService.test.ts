/**
 * DataExportService Tests
 *
 * Validates GDPR Article 20 data portability — exporting user profile,
 * subcollections, and Storage file URLs.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockListAll = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('firebase/storage', () => ({
    ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
    getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
    listAll: (...args: unknown[]) => mockListAll(...args),
}));

import { exportUserData, exportToBlob, type DataExportResult } from './DataExportService';

describe('DataExportService', () => {
    const TEST_USER_ID = 'uid-test-abc';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('exportUserData', () => {
        it('should export user profile from Firestore', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: TEST_USER_ID,
                data: () => ({
                    displayName: 'Test Artist',
                    email: 'artist@test.com',
                    bio: 'Independent producer',
                }),
            });

            // Empty subcollections
            mockGetDocs.mockResolvedValue({ docs: [] });

            // No Storage files
            mockListAll.mockResolvedValue({ items: [], prefixes: [] });

            const result = await exportUserData(TEST_USER_ID);

            expect(result.success).toBe(true);
            expect(result.data['profile']).toEqual(
                expect.objectContaining({
                    _id: TEST_USER_ID,
                    displayName: 'Test Artist',
                    email: 'artist@test.com',
                })
            );
            expect(result.exportedAt).toBeTruthy();
        });

        it('should export subcollection documents', async () => {
            // Profile
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: TEST_USER_ID,
                data: () => ({ displayName: 'Artist' }),
            });

            // Return docs for the first subcollection call, empty for rest
            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        docs: [
                            { id: 'release-1', data: () => ({ title: 'Album A', status: 'released' }) },
                            { id: 'release-2', data: () => ({ title: 'Single B', status: 'draft' }) },
                        ],
                    });
                }
                return Promise.resolve({ docs: [] });
            });

            mockListAll.mockResolvedValue({ items: [], prefixes: [] });

            const result = await exportUserData(TEST_USER_ID);

            expect(result.success).toBe(true);
            // The first exportable collection is 'releases'
            expect(result.data['releases']).toEqual([
                { _id: 'release-1', title: 'Album A', status: 'released' },
                { _id: 'release-2', title: 'Single B', status: 'draft' },
            ]);
        });

        it('should include Storage file URLs', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });
            mockGetDocs.mockResolvedValue({ docs: [] });

            mockListAll.mockResolvedValue({
                items: [
                    { fullPath: `users/${TEST_USER_ID}/cover-art.png` },
                    { fullPath: `users/${TEST_USER_ID}/track.wav` },
                ],
                prefixes: [],
            });

            mockGetDownloadURL.mockImplementation((itemRef: { fullPath: string }) =>
                Promise.resolve(`https://storage.example.com/${itemRef.fullPath}`)
            );

            const result = await exportUserData(TEST_USER_ID);

            expect(result.storageFileUrls).toHaveLength(2);
            expect(result.storageFileUrls[0]).toEqual({
                path: `users/${TEST_USER_ID}/cover-art.png`,
                url: expect.stringContaining('cover-art.png'),
            });
        });

        it('should handle restricted Storage files gracefully', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });
            mockGetDocs.mockResolvedValue({ docs: [] });

            mockListAll.mockResolvedValue({
                items: [{ fullPath: `users/${TEST_USER_ID}/restricted.pdf` }],
                prefixes: [],
            });

            mockGetDownloadURL.mockRejectedValue(new Error('403 Access Denied'));

            const result = await exportUserData(TEST_USER_ID);

            expect(result.storageFileUrls).toHaveLength(1);
            expect(result.storageFileUrls[0]!.url).toBe('[access_restricted]');
        });

        it('should record errors but not fail completely', async () => {
            // Profile fetch fails
            mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));
            mockGetDocs.mockResolvedValue({ docs: [] });
            mockListAll.mockResolvedValue({ items: [], prefixes: [] });

            const result = await exportUserData(TEST_USER_ID);

            // success is false when there are errors
            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to export profile');
        });

        it('should include export metadata', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                id: TEST_USER_ID,
                data: () => ({ displayName: 'Artist' }),
            });
            mockGetDocs.mockResolvedValue({ docs: [] });
            mockListAll.mockResolvedValue({ items: [], prefixes: [] });

            const result = await exportUserData(TEST_USER_ID);

            const metadata = result.data['_export_metadata'] as Record<string, unknown>;
            expect(metadata).toBeDefined();
            expect(metadata['userId']).toBe(TEST_USER_ID);
            expect(metadata['version']).toBe('1.0');
            expect(metadata['format']).toBe('indiiOS-GDPR-export');
        });
    });

    describe('exportToBlob', () => {
        it('should create a valid JSON blob from export result', () => {
            const result: DataExportResult = {
                success: true,
                data: { profile: { name: 'Test' } },
                storageFileUrls: [{ path: 'file.png', url: 'https://example.com/file.png' }],
                exportedAt: '2026-01-01T00:00:00Z',
                errors: [],
            };

            const blob = exportToBlob(result);

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('application/json');
            expect(blob.size).toBeGreaterThan(0);
        });
    });
});
