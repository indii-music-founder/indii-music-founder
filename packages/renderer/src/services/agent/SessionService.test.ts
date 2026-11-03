import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDocs, writeBatch } from 'firebase/firestore';

const firestoreMocks = vi.hoisted(() => ({
    transactionSet: vi.fn(),
    transactionUpdate: vi.fn(),
    transactionGet: vi.fn(),
    runTransaction: vi.fn(),
    batchDelete: vi.fn(),
    batchCommit: vi.fn().mockResolvedValue(undefined),
}));

// 1. Mock External Dependencies (Firebase/Firestore)
vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => 'server-timestamp'),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: {
        fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: ms / 1000, nanoseconds: 0 }),
        now: () => ({
  serverTimestamp: vi.fn(), toMillis: () => Date.now() })
    },
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    runTransaction: firestoreMocks.runTransaction,
    updateDoc: vi.fn(),
    query: vi.fn((ref: unknown) => ref),
    writeBatch: vi.fn(() => ({ delete: firestoreMocks.batchDelete, commit: firestoreMocks.batchCommit })),
    getDocs: vi.fn(),
}));

// 2. Mock FirestoreService Base Class
const { mockSet, mockUpdate, mockDelete, mockList } = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    mockSet: vi.fn().mockResolvedValue(undefined),
    mockUpdate: vi.fn().mockResolvedValue(undefined),
    mockDelete: vi.fn().mockResolvedValue(undefined),
    mockList: vi.fn().mockResolvedValue([])
}));

vi.mock('../FirestoreService', () => {
    return {
    serverTimestamp: vi.fn(),
        FirestoreService: class {
            set = mockSet;
            update = mockUpdate;
            delete = mockDelete;
            list = mockList;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            constructor(collectionPath: string) {}
        }
    };
});

// 3. Mock Auth & Org Services
vi.mock('../firebase', () => ({
  serverTimestamp: vi.fn(),
    auth: { currentUser: { uid: 'test-user-id' } },
    db: {}
}));

vi.mock('../OrganizationService', () => ({
  serverTimestamp: vi.fn(),
    OrganizationService: {
        getCurrentOrgId: () => 'test-org-id'
    }
}));

// 4. Import System Under Test
import { getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { sessionService } from './SessionService';
import { ConversationSession } from '@/core/store/slices/agent';

describe('SessionService Persistence (Dual Write)', () => {
    const mockElectronSave = vi.fn().mockResolvedValue({ success: true });
    const mockElectronDelete = vi.fn().mockResolvedValue({ success: true });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as Awaited<ReturnType<typeof getDocs>>);
        firestoreMocks.transactionGet.mockResolvedValue({
            exists: () => true,
            data: () => ({ messageStorage: 'array', messages: [{ id: 'legacy', role: 'user', text: 'Earlier', timestamp: 1 }] }),
        });
        firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<void>) => callback({
            get: firestoreMocks.transactionGet,
            set: firestoreMocks.transactionSet,
            update: firestoreMocks.transactionUpdate,
        }));

        // Setup window.electronAPI mock
        vi.stubGlobal('window', {
            electronAPI: {
                agent: {
                    saveHistory: mockElectronSave,
                    deleteHistory: mockElectronDelete
                }
            }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('createSession should save to Firestore AND Electron', async () => {
        const session: ConversationSession = {
            id: 'session-123',
            title: 'Test Chat',
            createdAt: 1000,
            updatedAt: 1000,
            messages: [],
            participants: ['indii']
        };

        await sessionService.createSession(session);

        // Verify Firestore (Cloud)
        expect(mockSet).toHaveBeenCalledWith('session-123', expect.objectContaining({
            userId: 'test-user-id',
            orgId: 'test-org-id'
        }));

        // Verify Electron (Local)
        expect(mockElectronSave).toHaveBeenCalledWith('session-123', session);
    });

    it('updateSession should update Firestore AND Electron', async () => {
        const updates = { title: 'New Title', updatedAt: 2000 };
        await sessionService.updateSession('session-123', updates);

        // Verify Firestore (Cloud)
        expect(mockUpdate).toHaveBeenCalledWith('session-123', expect.any(Object));

        // Verify Electron (Local)
        expect(mockElectronSave).toHaveBeenCalledWith('session-123', updates);
    });

    it('retries a local save when desktop IPC reports failure', async () => {
        vi.useFakeTimers();
        mockElectronSave.mockResolvedValueOnce({ success: false, error: 'disk busy' });
        await sessionService.createSession({
            id: 'session-123', title: 'Test Chat', createdAt: 1000, updatedAt: 1000,
            messages: [], participants: ['indii'],
        });

        await vi.runOnlyPendingTimersAsync();
        expect(mockElectronSave).toHaveBeenCalledTimes(2);
    });

    it('deleteSession should delete from Firestore AND Electron', async () => {
        await sessionService.deleteSession('session-123');

        // Verify Firestore (Cloud)
        expect(updateDoc).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ deletingAt: expect.anything() }));
        expect(mockDelete).toHaveBeenCalledWith('session-123');

        // Verify Electron (Local)
        expect(mockElectronDelete).toHaveBeenCalledWith('session-123');
    });

    it('deletes child messages in bounded batches before deleting the parent', async () => {
        const firstPage = Array.from({ length: 400 }, (_, index) => ({ ref: { path: `message-${index}` } }));
        const secondPage = [{ ref: { path: 'message-400' } }];
        vi.mocked(getDocs)
            .mockResolvedValueOnce({ empty: false, docs: firstPage } as Awaited<ReturnType<typeof getDocs>>)
            .mockResolvedValueOnce({ empty: false, docs: secondPage } as Awaited<ReturnType<typeof getDocs>>);

        await sessionService.deleteSession('session-123');

        expect(writeBatch).toHaveBeenCalledTimes(2);
        expect(firestoreMocks.batchDelete).toHaveBeenCalledTimes(401);
        expect(firestoreMocks.batchCommit).toHaveBeenCalledTimes(2);
        expect(firestoreMocks.batchCommit.mock.invocationCallOrder[1]).toBeLessThan(mockDelete.mock.invocationCallOrder[0]!);
    });

    it('leaves the fenced parent for retry when child deletion fails', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({ empty: false, docs: [{ ref: { path: 'message-1' } }] } as Awaited<ReturnType<typeof getDocs>>);
        firestoreMocks.batchCommit.mockRejectedValueOnce(new Error('batch failed'));

        await expect(sessionService.deleteSession('session-123')).rejects.toThrow('batch failed');
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockElectronDelete).not.toHaveBeenCalled();
    });

    it('reports a local deletion failure after cloud cleanup', async () => {
        mockElectronDelete.mockResolvedValueOnce({ success: false, error: 'disk unavailable' });

        await expect(sessionService.deleteSession('session-123')).rejects.toThrow('disk unavailable');
        expect(mockDelete).toHaveBeenCalledWith('session-123');
    });

    it('should handle missing electronAPI gracefully', async () => {
        // Remove electronAPI from window
        vi.stubGlobal('window', {});

        const session: ConversationSession = {
            id: 'session-456',
            title: 'Web Only Chat',
            createdAt: 1000,
            updatedAt: 1000,
            messages: [],
            participants: ['indii']
        };

        // Should not throw error
        await expect(sessionService.createSession(session)).resolves.not.toThrow();

        expect(mockSet).toHaveBeenCalled();
        expect(mockElectronSave).not.toHaveBeenCalled();
    });

    it('atomically migrates legacy history and appends the new message', async () => {
        await sessionService.appendMessage('session-123', {
            id: 'phone-message', role: 'user', text: 'From phone', timestamp: 2,
        });

        expect(firestoreMocks.runTransaction).toHaveBeenCalled();
        expect(firestoreMocks.transactionSet).toHaveBeenCalledTimes(2);
        expect(firestoreMocks.transactionUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ messageStorage: 'subcollection' })
        );
    });

    it('clears long histories in bounded batches before updating the session', async () => {
        const deleteMessage = vi.fn();
        const commit = vi.fn().mockResolvedValue(undefined);
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: Array.from({ length: 801 }, (_, i) => ({ ref: { path: `messages/${i}` } })),
        } as unknown as Awaited<ReturnType<typeof getDocs>>);
        vi.mocked(writeBatch).mockImplementation(() => ({ delete: deleteMessage, commit }) as unknown as ReturnType<typeof writeBatch>);

        await sessionService.clearMessages('session-123');

        expect(writeBatch).toHaveBeenCalledTimes(3);
        expect(deleteMessage).toHaveBeenCalledTimes(801);
        expect(commit).toHaveBeenCalledTimes(3);
        expect(mockUpdate).toHaveBeenCalledAfter(commit);
    });

    it('does not mark the session cleared when a delete batch fails', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [{ ref: { path: 'messages/1' } }],
        } as unknown as Awaited<ReturnType<typeof getDocs>>);
        vi.mocked(writeBatch).mockReturnValueOnce({
            delete: vi.fn(), commit: vi.fn().mockRejectedValue(new Error('write unavailable')),
        } as unknown as ReturnType<typeof writeBatch>);

        await expect(sessionService.clearMessages('session-123')).rejects.toThrow('write unavailable');
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
