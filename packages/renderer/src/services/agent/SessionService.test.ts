import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    transactionSet: vi.fn(),
    transactionUpdate: vi.fn(),
    transactionGet: vi.fn(),
    runTransaction: vi.fn(),
    batchDelete: vi.fn(),
    batchUpdate: vi.fn(),
    batchCommit: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    storeAttachments: vi.fn(),
    restoreAttachments: vi.fn(),
    loadAttachment: vi.fn(),
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
    onSnapshot: firestoreMocks.subscribe,
    updateDoc: vi.fn(),
    query: vi.fn((ref: unknown) => ref),
    writeBatch: vi.fn(() => ({ delete: firestoreMocks.batchDelete, update: firestoreMocks.batchUpdate, commit: firestoreMocks.batchCommit })),
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

vi.mock('./SessionAttachmentStorage', () => ({
    storeSessionAttachments: firestoreMocks.storeAttachments,
    restoreSessionAttachments: firestoreMocks.restoreAttachments,
    loadSessionAttachment: firestoreMocks.loadAttachment,
}));

// 4. Import System Under Test
import { getDocs, writeBatch } from 'firebase/firestore';
import { sessionService } from './SessionService';
import { ConversationSession } from '@/core/store/slices/agent';

describe('SessionService Persistence (Dual Write)', () => {
    const mockElectronSave = vi.fn().mockResolvedValue({ success: true });
    const mockElectronDelete = vi.fn().mockResolvedValue({ success: true });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as Awaited<ReturnType<typeof getDocs>>);
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => false }
            : { exists: () => true, data: () => ({ messageStorage: 'array', messages: [{ id: 'legacy', role: 'user', text: 'Earlier', timestamp: 1 }] }) });
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

    it('stores updated attachments outside the message document', async () => {
        const attachment = { mimeType: 'image/png', base64: 'AAEC' };
        const reference = { mimeType: 'image/png', storagePath: 'owner/path' };
        firestoreMocks.storeAttachments.mockResolvedValueOnce([reference]);
        await sessionService.updateMessage('session-123', 'message-1', { attachments: [attachment], text: 'Updated' });
        expect(firestoreMocks.storeAttachments).toHaveBeenCalledWith('test-user-id', 'session-123', 'message-1', [attachment]);
        expect(firestoreMocks.batchUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123/messages/message-1' }, { attachments: [reference], text: 'Updated' });
        expect(firestoreMocks.batchUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ messageStorage: 'subcollection' }));
        expect(firestoreMocks.batchCommit).toHaveBeenCalledTimes(1);
    });

    it('does not replace a saved attachment with an unavailable placeholder', async () => {
        await expect(sessionService.updateMessage('session-123', 'message-1', {
            attachments: [{ mimeType: 'image/png', base64: '', loadFailed: true }],
        })).rejects.toThrow(/could not be loaded/);
        expect(firestoreMocks.storeAttachments).not.toHaveBeenCalled();
        expect(firestoreMocks.batchCommit).not.toHaveBeenCalled();
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

    it('waits for an in-flight local save before deleting its cache', async () => {
        let finish!: (result: { success: boolean }) => void;
        mockElectronSave.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        await sessionService.createSession({
            id: 'pending-local-write', title: 'Test', createdAt: 1000, updatedAt: 1000,
            messages: [], participants: ['indii'],
        });
        const deletion = sessionService.deleteSession('pending-local-write');
        await Promise.resolve();
        expect(mockElectronDelete).not.toHaveBeenCalled();
        finish({ success: true });
        await deletion;
        expect(mockElectronDelete).toHaveBeenCalledWith('pending-local-write');
    });

    it('cancels a scheduled local save retry after deletion starts', async () => {
        vi.useFakeTimers();
        mockElectronSave.mockResolvedValueOnce({ success: false, error: 'disk busy' });
        await sessionService.createSession({
            id: 'pending-local-retry', title: 'Test', createdAt: 1000, updatedAt: 1000,
            messages: [], participants: ['indii'],
        });
        await Promise.resolve();
        expect(mockElectronSave).toHaveBeenCalledTimes(1);
        await sessionService.deleteSession('pending-local-retry');
        await vi.runOnlyPendingTimersAsync();
        expect(mockElectronSave).toHaveBeenCalledTimes(1);
    });

    it('deleteSession should delete from Firestore AND Electron', async () => {
        await sessionService.deleteSession('session-123');

        // Verify Firestore (Cloud)
        expect(firestoreMocks.transactionUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ deletingAt: expect.anything() }));
        expect(mockDelete).toHaveBeenCalledWith('session-123');

        // Verify Electron (Local)
        expect(mockElectronDelete).toHaveBeenCalledWith('session-123');
    });

    it('deletes child messages in bounded batches before deleting the parent', async () => {
        const firstPage = Array.from({ length: 400 }, (_, index) => ({ id: `message-${index}`, data: () => ({}), ref: { path: `message-${index}` } }));
        const secondPage = [{ id: 'message-400', data: () => ({}), ref: { path: 'message-400' } }];
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
        vi.mocked(getDocs).mockResolvedValueOnce({ empty: false, docs: [{ id: 'message-1', data: () => ({}), ref: { path: 'message-1' } }] } as Awaited<ReturnType<typeof getDocs>>);
        firestoreMocks.batchCommit.mockRejectedValueOnce(new Error('batch failed'));

        await expect(sessionService.deleteSession('session-123')).rejects.toThrow('batch failed');
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockElectronDelete).toHaveBeenCalled();
    });

    it('reuses the existing deletion fence on retry', async () => {
        firestoreMocks.transactionGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ deletingAt: 'original-fence' }) });
        await sessionService.deleteSession('session-123');
        expect(firestoreMocks.transactionUpdate).not.toHaveBeenCalled();
        expect(mockDelete).toHaveBeenCalledWith('session-123');
    });

    it('rejects appends after deletion has fenced the conversation', async () => {
        firestoreMocks.transactionGet.mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ messageStorage: 'subcollection', deletingAt: 'server-timestamp' }),
        });

        await expect(sessionService.appendMessage('session-123', {
            id: 'late-message', role: 'user', text: 'late', timestamp: 1,
        })).rejects.toThrow('conversation is being deleted');
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
        expect(firestoreMocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it('preserves the cloud conversation when local deletion fails', async () => {
        mockElectronDelete.mockResolvedValueOnce({ success: false, error: 'disk unavailable' });

        await expect(sessionService.deleteSession('session-123')).rejects.toThrow('disk unavailable');
        expect(mockDelete).not.toHaveBeenCalled();
        expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    });

    it('allows later local saves after local deletion fails', async () => {
        mockElectronDelete.mockResolvedValueOnce({ success: false, error: 'disk unavailable' });
        await expect(sessionService.deleteSession('local-failure-recovery')).rejects.toThrow('disk unavailable');
        await sessionService.updateSession('local-failure-recovery', { title: 'Still here' });
        expect(mockElectronSave).toHaveBeenCalledWith('local-failure-recovery', { title: 'Still here' });
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

    it('persists storage references without mutating the original message', async () => {
        const attachment = { mimeType: 'image/png', base64: 'AAEC' };
        const stored = { mimeType: 'image/png', storagePath: 'stored-object' };
        firestoreMocks.storeAttachments.mockResolvedValueOnce([stored]);
        const message = { id: 'image-message', role: 'user' as const, text: 'Reference', timestamp: 2, attachments: [attachment] };
        await sessionService.appendMessage('session-123', message);
        expect(firestoreMocks.storeAttachments).toHaveBeenCalledWith('test-user-id', 'session-123', 'image-message', [attachment]);
        expect(firestoreMocks.transactionSet).toHaveBeenCalledWith(expect.objectContaining({ path: 'sessions/session-123/messages/image-message' }), expect.objectContaining({ attachments: [stored] }));
        expect(message.attachments).toEqual([attachment]);
    });

    it('does not write a message when its attachment upload fails', async () => {
        firestoreMocks.storeAttachments.mockRejectedValueOnce(new Error('upload failed'));
        await expect(sessionService.appendMessage('session-123', { id: 'image', role: 'user', text: '', timestamp: 1,
            attachments: [{ mimeType: 'image/png', base64: 'AAEC' }] })).rejects.toThrow('upload failed');
        expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    });

    it('keeps older snapshots from overwriting a newer restored conversation', async () => {
        let snapshot!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        let finish!: (value: unknown) => void;
        firestoreMocks.loadAttachment.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const onUpdate = vi.fn();
        const onError = vi.fn();
        const unsubscribe = sessionService.subscribeToMessages('session-123', onUpdate, onError);
        snapshot({ docs: [{ id: 'first', data: () => ({ attachments: [{ mimeType: 'image/png', storagePath: 'path' }] }) }] });
        snapshot({ docs: [{ id: 'second', data: () => ({ role: 'user', text: 'Newer' }) }] });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ id: 'second' })]));
        finish({ mimeType: 'image/png', base64: 'AAEC' });
        await Promise.resolve();
        await Promise.resolve();
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('reuses the same attachment load across streaming snapshots', async () => {
        let snapshot!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        let finish!: (value: unknown) => void;
        firestoreMocks.loadAttachment.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const onUpdate = vi.fn();
        const unsubscribe = sessionService.subscribeToMessages('session-123', onUpdate, vi.fn());
        const docs = (text: string) => [{ id: 'first', data: () => ({ text, attachments: [{ mimeType: 'image/png', storagePath: 'path' }] }) }];
        snapshot({ docs: docs('first') });
        snapshot({ docs: docs('latest') });
        expect(firestoreMocks.loadAttachment).toHaveBeenCalledTimes(1);
        finish({ mimeType: 'image/png', base64: 'AAEC' });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ text: 'latest' })]));
        snapshot({ docs: docs('finished') });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ text: 'finished' })]));
        expect(firestoreMocks.loadAttachment).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it('keeps messages visible with a failure marker if an attachment cannot load', async () => {
        let snapshot!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        firestoreMocks.loadAttachment.mockRejectedValueOnce(new Error('Attachment unavailable'));
        const onUpdate = vi.fn();
        const onError = vi.fn();
        sessionService.subscribeToMessages('session-123', onUpdate, onError);
        snapshot({ docs: [{ id: 'first', data: () => ({ attachments: [{ mimeType: 'image/png', storagePath: 'path' }] }) }] });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ id: 'first', attachments: [{ mimeType: 'image/png', base64: '', loadFailed: true }] })]));
        expect(onError).not.toHaveBeenCalled();
    });

    it('restores attachment filenames with saved messages', async () => {
        let snapshot!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        firestoreMocks.loadAttachment.mockResolvedValueOnce({ mimeType: 'image/png', base64: 'AAEC', filename: 'cover.png' });
        const onUpdate = vi.fn();
        const unsubscribe = sessionService.subscribeToMessages('session-123', onUpdate, vi.fn());
        snapshot({ docs: [{ id: 'first', data: () => ({ attachments: [{ mimeType: 'image/png', storagePath: 'path', filename: 'cover.png' }] }) }] });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ attachments: [expect.objectContaining({ filename: 'cover.png' })] })]));
        expect(firestoreMocks.loadAttachment).toHaveBeenCalledWith('test-user-id', 'session-123', 'first', 0, expect.objectContaining({ filename: 'cover.png' }));
        unsubscribe();
    });

    it('retries a failed attachment load on the next snapshot', async () => {
        let snapshot!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        firestoreMocks.loadAttachment.mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ mimeType: 'image/png', base64: 'AAEC' });
        const onUpdate = vi.fn();
        const unsubscribe = sessionService.subscribeToMessages('session-123', onUpdate, vi.fn());
        const docs = [{ id: 'first', data: () => ({ attachments: [{ mimeType: 'image/png', storagePath: 'path' }] }) }];
        snapshot({ docs });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ attachments: [expect.objectContaining({ loadFailed: true })] })]));
        snapshot({ docs });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attachments: [{ mimeType: 'image/png', base64: 'AAEC' }] })]));
        expect(firestoreMocks.loadAttachment).toHaveBeenCalledTimes(2);
        unsubscribe();
    });

    it('does not publish an attachment after its conversation is closed', async () => {
        let snapshot!: (value: unknown) => void;
        let finish!: (value: unknown) => void;
        firestoreMocks.subscribe.mockImplementation((_query, callback) => { snapshot = callback; return vi.fn(); });
        firestoreMocks.loadAttachment.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const onUpdate = vi.fn();
        const unsubscribe = sessionService.subscribeToMessages('session-123', onUpdate, vi.fn());
        snapshot({ docs: [{ id: 'first', data: () => ({ attachments: [{ mimeType: 'image/png', storagePath: 'path' }] }) }] });
        unsubscribe();
        finish({ mimeType: 'image/png', base64: 'AAEC' });
        await Promise.resolve();
        await Promise.resolve();
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('keeps other messages and attachments visible when saved attachment data is malformed', async () => {
        const onUpdate = vi.fn();
        const onError = vi.fn();
        sessionService.subscribeToMessages('session-123', onUpdate, onError);
        const snapshot = firestoreMocks.subscribe.mock.calls[0]![1] as (value: unknown) => void;
        snapshot({ docs: [
            { id: 'broken', data: () => ({ text: 'Keep this', attachments: [null, { mimeType: 'image/png' }, { mimeType: 'text/plain', base64: 'aGk=' }] }) },
            { id: 'bad-list', data: () => ({ text: 'Bad list', attachments: 'not a list' }) },
            { id: 'next', data: () => ({ text: 'And this' }) },
        ] });
        await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledWith([
            expect.objectContaining({ id: 'broken', text: 'Keep this', attachments: [
                { mimeType: 'application/octet-stream', base64: '', loadFailed: true },
                { mimeType: 'image/png', base64: '', loadFailed: true },
                { mimeType: 'text/plain', base64: 'aGk=' },
            ] }),
            expect.objectContaining({ id: 'bad-list', text: 'Bad list', attachments: [
                { mimeType: 'application/octet-stream', base64: '', loadFailed: true },
            ] }),
            expect.objectContaining({ id: 'next', text: 'And this' }),
        ]));
        expect(onError).not.toHaveBeenCalled();
    });

    it('does not overwrite a message already committed under the same ID', async () => {
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => true, data: () => ({ role: 'model', text: 'original' }) }
            : { exists: () => true, data: () => ({ messageStorage: 'subcollection' }) });
        await expect(sessionService.appendMessage('session-123', { id: 'same-id', role: 'user', text: 'different', timestamp: 2 })).rejects.toThrow(/already in use/);
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
        expect(firestoreMocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it('accepts a matching saved user message without rewriting it', async () => {
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => true, data: () => ({ role: 'user', text: 'Original', attachments: [] }) }
            : { exists: () => true, data: () => ({ messageStorage: 'subcollection' }) });
        await sessionService.appendMessage('session-123', { id: 'same-id', role: 'user', text: 'Original', timestamp: 2 });
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
    });

    it.each(['stored', 'legacy'])('accepts a retry of a matching %s attachment', async format => {
        const attachment = { mimeType: 'image/png', base64: 'AAEC' };
        const uploaded = { mimeType: 'image/png', storagePath: 'owner/path' };
        firestoreMocks.storeAttachments.mockResolvedValueOnce([uploaded]);
        // Firestore may return map fields in a different order than the upload result.
        const savedAttachment = format === 'stored'
            ? { storagePath: uploaded.storagePath, mimeType: uploaded.mimeType }
            : { base64: attachment.base64, mimeType: attachment.mimeType };
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => true, data: () => ({ role: 'user', text: 'Original', attachments: [savedAttachment] }) }
            : { exists: () => true, data: () => ({ messageStorage: 'subcollection' }) });

        await expect(sessionService.appendMessage('session-123', {
            id: 'same-id', role: 'user', text: 'Original', timestamp: 2, attachments: [attachment],
        })).resolves.toBeUndefined();
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
    });

    it('rejects a retry whose saved attachment differs', async () => {
        firestoreMocks.storeAttachments.mockResolvedValueOnce([{ mimeType: 'image/png', storagePath: 'owner/new' }]);
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => true, data: () => ({ role: 'user', text: 'Original', attachments: [{ mimeType: 'image/png', storagePath: 'owner/old' }] }) }
            : { exists: () => true, data: () => ({ messageStorage: 'subcollection' }) });
        await expect(sessionService.appendMessage('session-123', {
            id: 'same-id', role: 'user', text: 'Original', timestamp: 2, attachments: [{ mimeType: 'image/png', base64: 'AAEC' }],
        })).rejects.toThrow(/already in use/);
    });

    it('rejects the same user message ID with different text', async () => {
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => true, data: () => ({ role: 'user', text: 'Original', attachments: [] }) }
            : { exists: () => true, data: () => ({ messageStorage: 'subcollection' }) });
        await expect(sessionService.appendMessage('session-123', { id: 'same-id', role: 'user', text: 'Changed', timestamp: 2 })).rejects.toThrow(/already in use/);
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
    });

    it('atomically migrates legacy history and appends the new message', async () => {
        await sessionService.appendMessage('session-123', {
            id: 'phone-message', role: 'user', text: 'From phone', timestamp: 2,
        });

        expect(firestoreMocks.runTransaction).toHaveBeenCalled();
        expect(firestoreMocks.transactionSet).toHaveBeenCalledTimes(2);
        expect(firestoreMocks.transactionUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ messageStorage: 'subcollection', messages: [] })
        );
    });

    it('does not overwrite a legacy message when a new append reuses its ID', async () => {
        await expect(sessionService.appendMessage('session-123', {
            id: 'legacy', role: 'user', text: 'Different message', timestamp: 2,
        })).rejects.toThrow(/already in use by legacy/);
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
        expect(firestoreMocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it('clears an inline-only history even when there are no child messages', async () => {
        await sessionService.clearMessages('session-123');
        expect(firestoreMocks.batchUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ messages: [], messageStorage: 'subcollection' }));
        expect(firestoreMocks.batchCommit).toHaveBeenCalledTimes(1);
    });

    it('clears long histories in bounded batches before updating the session', async () => {
        const deleteMessage = vi.fn();
        const updateParent = vi.fn();
        const commit = vi.fn().mockResolvedValue(undefined);
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: Array.from({ length: 801 }, (_, i) => ({ ref: { path: `messages/${i}` } })),
        } as unknown as Awaited<ReturnType<typeof getDocs>>);
        vi.mocked(writeBatch).mockImplementation(() => ({ delete: deleteMessage, update: updateParent, commit }) as unknown as ReturnType<typeof writeBatch>);

        await sessionService.clearMessages('session-123');

        expect(writeBatch).toHaveBeenCalledTimes(3);
        expect(deleteMessage).toHaveBeenCalledTimes(801);
        expect(commit).toHaveBeenCalledTimes(3);
        expect(updateParent).toHaveBeenCalledTimes(1);
        expect(updateParent).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ messages: [], messageStorage: 'subcollection' }));
    });

    it('does not mark the session cleared when a delete batch fails', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [{ ref: { path: 'messages/1' } }],
        } as unknown as Awaited<ReturnType<typeof getDocs>>);
        vi.mocked(writeBatch).mockReturnValueOnce({
            delete: vi.fn(), update: vi.fn(), commit: vi.fn().mockRejectedValue(new Error('write unavailable')),
        } as unknown as ReturnType<typeof writeBatch>);

        await expect(sessionService.clearMessages('session-123')).rejects.toThrow('write unavailable');
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
