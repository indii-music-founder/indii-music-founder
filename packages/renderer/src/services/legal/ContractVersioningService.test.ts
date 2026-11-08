import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContractVersioningService } from './ContractVersioningService';

const {
    mockDoc,
    mockAddDoc,
    mockGetDoc,
    mockGetDocs,
    mockCollection,
    mockQuery,
    mockOrderBy,
} = vi.hoisted(() => ({
    mockDoc: vi.fn(),
    mockAddDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn(),
    mockQuery: vi.fn(),
    mockOrderBy: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: mockDoc,
    addDoc: mockAddDoc,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    collection: mockCollection,
    query: mockQuery,
    orderBy: mockOrderBy,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
}));

describe('ContractVersioningService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection.mockImplementation((_db, ...segs) => segs.join('/'));
        mockDoc.mockImplementation((_db, ...segs) => segs.join('/'));
    });

    describe('publishNewVersion', () => {
        it('publishes version 1 when no previous versions exist', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: true,
                docs: [],
            });
            mockAddDoc.mockResolvedValueOnce({ id: 'ver-1' });

            const id = await ContractVersioningService.publishNewVersion('template-split-sheet', {
                title: 'Master Split Sheet',
                content: 'Split agreement terms...',
                fields: ['{{artistName}}', '{{percentage}}'],
                createdBy: 'user-alice',
                changeNotes: 'Initial template version',
            });

            expect(id).toBe('ver-1');
            expect(mockAddDoc).toHaveBeenCalledWith(
                'legal_templates/template-split-sheet/versions',
                expect.objectContaining({
                    version: 1,
                    title: 'Master Split Sheet',
                    content: 'Split agreement terms...',
                    fields: ['{{artistName}}', '{{percentage}}'],
                    createdBy: 'user-alice',
                    changeNotes: 'Initial template version',
                    isActive: true,
                    createdAt: 'MOCK_TIMESTAMP',
                })
            );
        });

        it('auto-increments version number from latest existing version', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [{ data: () => ({ version: 3 }) }],
            });
            mockAddDoc.mockResolvedValueOnce({ id: 'ver-4' });

            const id = await ContractVersioningService.publishNewVersion('template-split-sheet', {
                title: 'Master Split Sheet v4',
                content: 'Updated royalty clause...',
                fields: ['{{artistName}}', '{{percentage}}'],
                createdBy: 'user-alice',
                changeNotes: 'Updated legal language',
            });

            expect(id).toBe('ver-4');
            expect(mockAddDoc).toHaveBeenCalledWith(
                'legal_templates/template-split-sheet/versions',
                expect.objectContaining({
                    version: 4,
                    title: 'Master Split Sheet v4',
                    isActive: true,
                })
            );
        });
    });

    describe('getActiveVersion', () => {
        it('returns active version if available', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    {
                        id: 'ver-2',
                        data: () => ({
                            version: 2,
                            title: 'Active Template',
                            content: 'Terms v2',
                            isActive: true,
                        }),
                    },
                ],
            });

            const active = await ContractVersioningService.getActiveVersion('template-1');
            expect(active).not.toBeNull();
            expect(active?.id).toBe('ver-2');
            expect(active?.version).toBe(2);
        });

        it('returns null if no versions exist', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: true,
                docs: [],
            });

            const active = await ContractVersioningService.getActiveVersion('empty-template');
            expect(active).toBeNull();
        });
    });

    describe('getVersion', () => {
        it('fetches specific version by ID', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                id: 'ver-historical',
                data: () => ({
                    version: 1,
                    title: 'Historical Template',
                    content: 'Old terms',
                }),
            });

            const ver = await ContractVersioningService.getVersion('template-1', 'ver-historical');
            expect(ver).not.toBeNull();
            expect(ver?.id).toBe('ver-historical');
            expect(ver?.version).toBe(1);
        });

        it('returns null if version does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
            });

            const ver = await ContractVersioningService.getVersion('template-1', 'missing-ver');
            expect(ver).toBeNull();
        });
    });

    describe('getVersionHistory', () => {
        it('returns list of all versions ordered by version descending', async () => {
            mockGetDocs.mockResolvedValueOnce({
                docs: [
                    { id: 'ver-2', data: () => ({ version: 2, title: 'v2' }) },
                    { id: 'ver-1', data: () => ({ version: 1, title: 'v1' }) },
                ],
            });

            const history = await ContractVersioningService.getVersionHistory('template-1');
            expect(history).toHaveLength(2);
            expect(history[0].version).toBe(2);
            expect(history[1].version).toBe(1);
        });
    });
});
