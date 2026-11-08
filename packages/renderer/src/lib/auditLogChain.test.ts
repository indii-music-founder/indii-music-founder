import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeAuditLog, verifyAuditChain } from './auditLogChain';

const {
    mockDoc,
    mockSetDoc,
    mockCollection,
    mockQuery,
    mockOrderBy,
    mockLimit,
    mockGetDocs,
} = vi.hoisted(() => ({
    mockDoc: vi.fn(),
    mockSetDoc: vi.fn(),
    mockCollection: vi.fn(),
    mockQuery: vi.fn(),
    mockOrderBy: vi.fn(),
    mockLimit: vi.fn(),
    mockGetDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    doc: mockDoc,
    setDoc: mockSetDoc,
    collection: mockCollection,
    query: mockQuery,
    orderBy: mockOrderBy,
    limit: mockLimit,
    getDocs: mockGetDocs,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
}));

describe('auditLogChain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCollection.mockImplementation((_db, coll, uid, sub) => `${coll}/${uid}/${sub}`);
        mockDoc.mockImplementation((_db, coll, uid, sub, id) => `${coll}/${uid}/${sub}/${id}`);
    });

    describe('writeAuditLog', () => {
        it('writes genesis entry when no previous entry exists', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: true,
                docs: [],
            });
            mockSetDoc.mockResolvedValueOnce(undefined);

            const entryId = await writeAuditLog('user-1', 'user.signup', { method: 'email' });

            expect(entryId).toMatch(/^audit_\d+_1$/);
            expect(mockSetDoc).toHaveBeenCalledWith(
                `users/user-1/auditLogs/${entryId}`,
                expect.objectContaining({
                    id: entryId,
                    userId: 'user-1',
                    action: 'user.signup',
                    details: { method: 'email' },
                    sequenceNumber: 1,
                    prevHash: '0'.repeat(64),
                    timestamp: 'MOCK_TIMESTAMP',
                })
            );
        });

        it('chains entry to latest entry hash and increments sequence number', async () => {
            const previousHash = 'a'.repeat(64);
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [
                    {
                        data: () => ({
                            entryHash: previousHash,
                            sequenceNumber: 5,
                        }),
                    },
                ],
            });
            mockSetDoc.mockResolvedValueOnce(undefined);

            const entryId = await writeAuditLog('user-1', 'release.published', { releaseId: 'rel-100' });

            expect(entryId).toMatch(/^audit_\d+_6$/);
            expect(mockSetDoc).toHaveBeenCalledWith(
                `users/user-1/auditLogs/${entryId}`,
                expect.objectContaining({
                    id: entryId,
                    userId: 'user-1',
                    action: 'release.published',
                    sequenceNumber: 6,
                    prevHash: previousHash,
                })
            );
        });
    });

    describe('verifyAuditChain', () => {
        it('returns valid when audit log is empty', async () => {
            mockGetDocs.mockResolvedValueOnce({
                empty: true,
                docs: [],
                size: 0,
            });

            const result = await verifyAuditChain('user-1');
            expect(result.valid).toBe(true);
            expect(result.entriesChecked).toBe(0);
        });

        it('validates a sequence of authentic entries', async () => {
            // Compute real hash for entry 1
            const payload1 = JSON.stringify({
                action: 'login',
                details: {},
                sequenceNumber: 1,
                prevHash: '0'.repeat(64),
            });
            const encoder = new TextEncoder();
            const buf1 = await crypto.subtle.digest('SHA-256', encoder.encode(payload1));
            const hash1 = Array.from(new Uint8Array(buf1)).map(b => b.toString(16).padStart(2, '0')).join('');

            // Compute real hash for entry 2
            const payload2 = JSON.stringify({
                action: 'profile.update',
                details: { name: 'Alice' },
                sequenceNumber: 2,
                prevHash: hash1,
            });
            const buf2 = await crypto.subtle.digest('SHA-256', encoder.encode(payload2));
            const hash2 = Array.from(new Uint8Array(buf2)).map(b => b.toString(16).padStart(2, '0')).join('');

            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                size: 2,
                docs: [
                    {
                        data: () => ({
                            id: 'audit_1',
                            action: 'login',
                            details: {},
                            sequenceNumber: 1,
                            prevHash: '0'.repeat(64),
                            entryHash: hash1,
                        }),
                    },
                    {
                        data: () => ({
                            id: 'audit_2',
                            action: 'profile.update',
                            details: { name: 'Alice' },
                            sequenceNumber: 2,
                            prevHash: hash1,
                            entryHash: hash2,
                        }),
                    },
                ],
            });

            const result = await verifyAuditChain('user-1');
            expect(result.valid).toBe(true);
            expect(result.entriesChecked).toBe(2);
        });

        it('detects tampering if prevHash in chain is mismatched', async () => {
            const payload1 = JSON.stringify({
                action: 'login',
                details: {},
                sequenceNumber: 1,
                prevHash: '0'.repeat(64),
            });
            const encoder = new TextEncoder();
            const buf1 = await crypto.subtle.digest('SHA-256', encoder.encode(payload1));
            const hash1 = Array.from(new Uint8Array(buf1)).map(b => b.toString(16).padStart(2, '0')).join('');

            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                size: 2,
                docs: [
                    {
                        data: () => ({
                            id: 'audit_1',
                            action: 'login',
                            details: {},
                            sequenceNumber: 1,
                            prevHash: '0'.repeat(64),
                            entryHash: hash1,
                        }),
                    },
                    {
                        data: () => ({
                            id: 'audit_2',
                            action: 'profile.update',
                            details: {},
                            sequenceNumber: 2,
                            prevHash: 'tampered-prev-hash', // Mismatched!
                            entryHash: 'some-hash',
                        }),
                    },
                ],
            });

            const result = await verifyAuditChain('user-1');
            expect(result.valid).toBe(false);
            expect(result.brokenAt).toBe(2);
            expect(result.error).toContain('prevHash mismatch');
        });
    });
});
