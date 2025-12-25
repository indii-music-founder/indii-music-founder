import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Mock Firebase modules before importing CleanupService
vi.mock('./firebase', () => ({
    db: {},
    storage: {}
}));

// Mock Firestore
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    query: vi.fn(),
    where: vi.fn()
}));

// Mock Firebase Storage
const mockListAll = vi.fn();
const mockDeleteObject = vi.fn();
const mockRef = vi.fn();

vi.mock('firebase/storage', () => ({
    ref: (...args: unknown[]) => mockRef(...args),
    listAll: (...args: unknown[]) => mockListAll(...args),
    deleteObject: (...args: unknown[]) => mockDeleteObject(...args)
}));

// Mock dependent services
vi.mock('./ProjectService', () => ({
    ProjectService: {}
}));

vi.mock('./OrganizationService', () => ({
    OrganizationService: {}
}));

import { CleanupService, CleanupReport, CleanupOptions } from './CleanupService';

describe('CleanupService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('scan', () => {
        it('returns empty report when no orphaned records exist', async () => {
            // Mock projects collection
            mockGetDocs.mockImplementation((collectionRef) => {
                // Return different data based on collection
                return Promise.resolve({
                    docs: [],
                    size: 0
                });
            });

            const report = await CleanupService.scan();

            expect(report.orphanedHistoryItems).toHaveLength(0);
            expect(report.orphanedProjects).toHaveLength(0);
            expect(report.orphanedStorageFiles).toHaveLength(0);
            expect(report.summary.totalOrphaned).toBe(0);
        });

        it('identifies orphaned history items with missing projects', async () => {
            // Create mock data
            const projectDocs = [
                { id: 'project-1', data: () => ({ orgId: 'org-1' }) }
            ];
            const orgDocs = [
                { id: 'org-1', data: () => ({ name: 'Org 1' }) }
            ];
            const historyDocs = [
                {
                    id: 'history-1',
                    data: () => ({
                        projectId: 'project-1', // Valid
                        orgId: 'org-1',
                        type: 'image',
                        prompt: 'Test prompt'
                    })
                },
                {
                    id: 'history-2',
                    data: () => ({
                        projectId: 'deleted-project', // Orphaned
                        orgId: 'org-1',
                        type: 'video',
                        prompt: 'Orphaned prompt'
                    })
                }
            ];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });

            const report = await CleanupService.scan();

            expect(report.orphanedHistoryItems).toHaveLength(1);
            expect(report.orphanedHistoryItems[0].id).toBe('history-2');
            expect(report.orphanedHistoryItems[0].reason).toContain('deleted-project');
        });

        it('identifies orphaned history items with missing organizations', async () => {
            const projectDocs = [
                { id: 'project-1', data: () => ({ orgId: 'org-1' }) }
            ];
            const orgDocs = [
                { id: 'org-1', data: () => ({ name: 'Org 1' }) }
            ];
            const historyDocs = [
                {
                    id: 'history-orphaned',
                    data: () => ({
                        projectId: 'project-1',
                        orgId: 'deleted-org', // Orphaned org
                        type: 'image'
                    })
                }
            ];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });

            const report = await CleanupService.scan();

            expect(report.orphanedHistoryItems).toHaveLength(1);
            expect(report.orphanedHistoryItems[0].reason).toContain('deleted-org');
        });

        it('identifies orphaned projects with missing organizations', async () => {
            const projectDocs = [
                { id: 'project-1', data: () => ({ orgId: 'deleted-org', name: 'Orphaned Project', type: 'creative' }) },
                { id: 'project-2', data: () => ({ orgId: 'org-1', name: 'Valid Project', type: 'video' }) }
            ];
            const orgDocs = [
                { id: 'org-1', data: () => ({ name: 'Org 1' }) }
            ];
            const historyDocs: unknown[] = [];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });

            const report = await CleanupService.scan();

            expect(report.orphanedProjects).toHaveLength(1);
            expect(report.orphanedProjects[0].id).toBe('project-1');
            expect(report.orphanedProjects[0].reason).toContain('deleted-org');
        });

        it('excludes personal and default org IDs from orphan detection', async () => {
            const projectDocs = [
                { id: 'project-1', data: () => ({ orgId: 'personal', name: 'Personal Project' }) },
                { id: 'project-2', data: () => ({ orgId: 'org-default', name: 'Default Project' }) }
            ];
            const orgDocs: unknown[] = [];
            const historyDocs = [
                { id: 'history-1', data: () => ({ projectId: 'default', orgId: 'personal' }) }
            ];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });

            const report = await CleanupService.scan();

            expect(report.orphanedProjects).toHaveLength(0);
            expect(report.orphanedHistoryItems).toHaveLength(0);
        });

        it('calls progress callback during scan', async () => {
            mockGetDocs.mockResolvedValue({ docs: [] });

            const onProgress = vi.fn();
            await CleanupService.scan({ onProgress });

            expect(onProgress).toHaveBeenCalled();
            expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Fetching'), expect.any(Number), expect.any(Number));
        });

        it('calculates correct summary totals', async () => {
            const projectDocs = [{ id: 'p1', data: () => ({ orgId: 'org-1' }) }];
            const orgDocs = [{ id: 'org-1', data: () => ({}) }];
            const historyDocs = [
                { id: 'h1', data: () => ({ projectId: 'missing', orgId: 'org-1' }) },
                { id: 'h2', data: () => ({ projectId: 'missing2', orgId: 'org-1' }) }
            ];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });

            const report = await CleanupService.scan();

            expect(report.summary.historyItemsFound).toBe(2);
            expect(report.summary.projectsFound).toBe(0);
            expect(report.summary.storageFilesFound).toBe(0);
            expect(report.summary.totalOrphaned).toBe(2);
        });
    });

    describe('execute', () => {
        it('deletes orphaned history items', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);
            mockDoc.mockReturnValue({ id: 'history-1' });

            const report: CleanupReport = {
                orphanedHistoryItems: [
                    { id: 'history-1', collection: 'history', reason: 'Project deleted' },
                    { id: 'history-2', collection: 'history', reason: 'Project deleted' }
                ],
                orphanedProjects: [],
                orphanedStorageFiles: [],
                summary: { historyItemsFound: 2, projectsFound: 0, storageFilesFound: 0, totalOrphaned: 2 }
            };

            const result = await CleanupService.execute(report);

            expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
            expect(result.deletedHistory).toBe(2);
            expect(result.errors).toHaveLength(0);
        });

        it('deletes orphaned projects', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);
            mockDoc.mockReturnValue({ id: 'project-1' });

            const report: CleanupReport = {
                orphanedHistoryItems: [],
                orphanedProjects: [
                    { id: 'project-1', collection: 'projects', reason: 'Org deleted' }
                ],
                orphanedStorageFiles: [],
                summary: { historyItemsFound: 0, projectsFound: 1, storageFilesFound: 0, totalOrphaned: 1 }
            };

            const result = await CleanupService.execute(report);

            expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
            expect(result.deletedProjects).toBe(1);
        });

        it('deletes orphaned storage files', async () => {
            mockDeleteObject.mockResolvedValue(undefined);
            mockRef.mockReturnValue({});

            const report: CleanupReport = {
                orphanedHistoryItems: [],
                orphanedProjects: [],
                orphanedStorageFiles: ['generated/file1.png', 'generated/file2.png'],
                summary: { historyItemsFound: 0, projectsFound: 0, storageFilesFound: 2, totalOrphaned: 2 }
            };

            const result = await CleanupService.execute(report);

            expect(mockDeleteObject).toHaveBeenCalledTimes(2);
            expect(result.deletedStorageFiles).toBe(2);
        });

        it('captures errors without stopping execution', async () => {
            mockDeleteDoc.mockRejectedValueOnce(new Error('Permission denied'))
                .mockResolvedValue(undefined);
            mockDoc.mockReturnValue({});

            const report: CleanupReport = {
                orphanedHistoryItems: [
                    { id: 'history-1', collection: 'history', reason: 'Test' },
                    { id: 'history-2', collection: 'history', reason: 'Test' }
                ],
                orphanedProjects: [],
                orphanedStorageFiles: [],
                summary: { historyItemsFound: 2, projectsFound: 0, storageFilesFound: 0, totalOrphaned: 2 }
            };

            const result = await CleanupService.execute(report);

            expect(result.deletedHistory).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Permission denied');
        });

        it('calls progress callback during deletion', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);
            mockDoc.mockReturnValue({});

            const report: CleanupReport = {
                orphanedHistoryItems: [
                    { id: 'h1', collection: 'history', reason: 'Test' }
                ],
                orphanedProjects: [],
                orphanedStorageFiles: [],
                summary: { historyItemsFound: 1, projectsFound: 0, storageFilesFound: 0, totalOrphaned: 1 }
            };

            const onProgress = vi.fn();
            await CleanupService.execute(report, { onProgress });

            expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Deleted'), 1, 1);
        });
    });

    describe('vacuum', () => {
        it('performs scan only when dryRun is true', async () => {
            mockGetDocs.mockResolvedValue({ docs: [] });

            const result = await CleanupService.vacuum({ dryRun: true });

            expect(result.report).toBeDefined();
            expect(result.result.deletedHistory).toBe(0);
            expect(result.result.deletedProjects).toBe(0);
            expect(result.result.deletedStorageFiles).toBe(0);
            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });

        it('performs scan and execute when dryRun is false', async () => {
            const projectDocs = [{ id: 'p1', data: () => ({ orgId: 'org-1' }) }];
            const orgDocs = [{ id: 'org-1', data: () => ({}) }];
            const historyDocs = [
                { id: 'h1', data: () => ({ projectId: 'deleted-project', orgId: 'org-1' }) }
            ];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                return Promise.resolve({ docs: [] });
            });
            mockDeleteDoc.mockResolvedValue(undefined);
            mockDoc.mockReturnValue({});

            const result = await CleanupService.vacuum({ dryRun: false });

            expect(result.report.orphanedHistoryItems).toHaveLength(1);
            expect(result.result.deletedHistory).toBe(1);
            expect(mockDeleteDoc).toHaveBeenCalled();
        });
    });

    describe('quickCheck', () => {
        it('returns counts for all collections', async () => {
            mockGetDocs
                .mockResolvedValueOnce({ size: 10 }) // history
                .mockResolvedValueOnce({ size: 5 })  // projects
                .mockResolvedValueOnce({ size: 2 }); // organizations

            const result = await CleanupService.quickCheck();

            expect(result.historyCount).toBe(10);
            expect(result.projectCount).toBe(5);
            expect(result.orgCount).toBe(2);
        });
    });

    describe('storage scanning', () => {
        it('scans storage when includeStorage is true', async () => {
            const projectDocs = [{ id: 'p1', data: () => ({ orgId: 'org-1' }) }];
            const orgDocs = [{ id: 'org-1', data: () => ({}) }];
            const historyDocs = [{ id: 'existing-file', data: () => ({ projectId: 'p1', orgId: 'org-1' }) }];

            let callCount = 0;
            mockGetDocs.mockImplementation(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ docs: projectDocs });
                if (callCount === 2) return Promise.resolve({ docs: orgDocs });
                if (callCount === 3) return Promise.resolve({ docs: historyDocs });
                if (callCount === 4) return Promise.resolve({ docs: projectDocs });
                // For storage scan - history lookup
                if (callCount === 5) return Promise.resolve({ docs: historyDocs });
                return Promise.resolve({ docs: [] });
            });

            mockRef.mockReturnValue({});
            mockListAll.mockResolvedValue({
                items: [
                    { name: 'existing-file' },
                    { name: 'orphaned-file' }
                ]
            });

            const report = await CleanupService.scan({ includeStorage: true });

            expect(mockListAll).toHaveBeenCalled();
            expect(report.orphanedStorageFiles).toContain('generated/orphaned-file');
            expect(report.orphanedStorageFiles).not.toContain('generated/existing-file');
        });

        it('handles storage scanning errors gracefully', async () => {
            mockGetDocs.mockResolvedValue({ docs: [] });
            mockRef.mockReturnValue({});
            mockListAll.mockRejectedValue(new Error('Storage access denied'));

            const report = await CleanupService.scan({ includeStorage: true });

            expect(report.orphanedStorageFiles).toHaveLength(0);
            // Should not throw
        });
    });
});
