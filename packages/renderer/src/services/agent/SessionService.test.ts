import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    transactionSet: vi.fn(),
    transactionDelete: vi.fn(),
    serverGet: vi.fn(),
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
    getDocsFromServer: vi.fn(),
    getDocFromServer: firestoreMocks.serverGet,
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
import { getDocs, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { sessionService } from './SessionService';
import { ConversationSession } from '@/core/store/slices/agent';

describe('SessionService Persistence (Dual Write)', () => {
    const mockElectronSave = vi.fn().mockResolvedValue({ success: true });
    const mockElectronDelete = vi.fn().mockResolvedValue({ success: true });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as Awaited<ReturnType<typeof getDocs>>);
        vi.mocked(getDocsFromServer).mockResolvedValue({ empty: true, docs: [] } as unknown as Awaited<ReturnType<typeof getDocsFromServer>>);
        firestoreMocks.transactionUpdate.mockReset();
        firestoreMocks.serverGet.mockResolvedValue({ exists: () => true, data: () => ({ messageStorage: 'array', messages: [] }) });
        firestoreMocks.transactionGet.mockImplementation(async (ref: { path: string }) => ref.path.includes('/messages/')
            ? { exists: () => false }
            : { exists: () => true, data: () => ({ messageStorage: 'array', messages: [{ id: 'legacy', role: 'user', text: 'Earlier', timestamp: 1 }] }) });
        firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, callback: (transaction: unknown) => Promise<void>) => callback({
            get: firestoreMocks.transactionGet,
            set: firestoreMocks.transactionSet,
            delete: firestoreMocks.transactionDelete,
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
        firestoreMocks.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
        await sessionService.updateMessage('session-123', 'message-1', { attachments: [attachment], text: 'Updated' });
        expect(firestoreMocks.storeAttachments).toHaveBeenCalledWith('test-user-id', 'session-123', 'message-1', [attachment]);
        expect(firestoreMocks.transactionUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123/messages/message-1' }, { attachments: [reference], text: 'Updated', messageEpoch: 0 });
        expect(firestoreMocks.transactionUpdate).toHaveBeenCalledWith({ path: 'sessions/session-123' }, expect.objectContaining({ messageStorage: 'subcollection' }));
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

    function clearingState(initial: Record<string, unknown> = {}) {
        const data: Record<string, unknown> = { messages: [{ id: 'legacy' }], ...initial };
        firestoreMocks.transactionGet.mockImplementation(async () => ({ exists: () => true, data: () => ({ ...data }) }));
        firestoreMocks.transactionUpdate.mockImplementation((_ref, changes) => Object.assign(data, changes));
        return data;
    }

    it('clears inline history under a durable generation fence', async () => {
        const state = clearingState();
        await sessionService.clearMessages('session-123');
        expect(state).toMatchObject({ messages: [], messageEpoch: 1, messageStorage: 'subcollection', clearingOperation: null });
        expect(firestoreMocks.transactionUpdate.mock.calls[0]?.[1]).toMatchObject({ messageEpoch: 1, clearingOperation: expect.any(String), messages: [] });
        expect(firestoreMocks.transactionDelete).not.toHaveBeenCalled();
    });

    it('drains server-backed bounded pages while holding the clear token', async () => {
        const state = clearingState();
        for (const size of [400, 400, 1]) vi.mocked(getDocsFromServer).mockResolvedValueOnce({
            empty: false, docs: Array.from({ length: size }, (_, i) => ({ ref: { path: `messages/${size}-${i}` } })),
        } as unknown as Awaited<ReturnType<typeof getDocsFromServer>>);
        await sessionService.clearMessages('session-123');
        expect(getDocsFromServer).toHaveBeenCalledTimes(4);
        expect(firestoreMocks.transactionDelete).toHaveBeenCalledTimes(801);
        expect(state.clearingOperation).toBeNull();
    });

    it('keeps a failed clear fenced and permits a new explicit clear to take over', async () => {
        const state = clearingState();
        vi.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('server unavailable'));
        await expect(sessionService.clearMessages('session-123')).rejects.toThrow('server unavailable');
        const firstToken = state.clearingOperation;
        expect(firstToken).toEqual(expect.any(String));
        expect(state.messageEpoch).toBe(1);
        await sessionService.clearMessages('session-123');
        expect(state).toMatchObject({ messageEpoch: 2, clearingOperation: null });
        expect(firestoreMocks.transactionUpdate.mock.calls[1]?.[1].clearingOperation).not.toBe(firstToken);
    });

    it('resumes the same interrupted operation without advancing generation again', async () => {
        const state = clearingState();
        const operation = { id: 'same-clear' };
        vi.mocked(getDocsFromServer).mockRejectedValueOnce(new Error('offline'));
        await expect(sessionService.clearMessages('session-123', operation)).rejects.toThrow('offline');
        await sessionService.clearMessages('session-123', operation);
        expect(state).toMatchObject({ messageEpoch: 1, clearingOperation: null, lastClearedOperation: 'same-clear' });
    });

    it('does not repeat a completed clear after its final acknowledgement was lost', async () => {
        const state = clearingState();
        const operation = { id: 'completed-clear' };
        let transactions = 0;
        firestoreMocks.runTransaction.mockImplementation(async (_db, callback) => {
            const result = await callback({ get: firestoreMocks.transactionGet, update: firestoreMocks.transactionUpdate, delete: firestoreMocks.transactionDelete });
            if (++transactions === 2) throw new Error('final acknowledgement lost');
            return result;
        });
        await expect(sessionService.clearMessages('session-123', operation)).rejects.toThrow('final acknowledgement lost');
        expect(state.lastClearedOperation).toBe('completed-clear');
        vi.mocked(getDocsFromServer).mockClear();
        await sessionService.clearMessages('session-123', operation);
        expect(getDocsFromServer).not.toHaveBeenCalled();
        expect(firestoreMocks.transactionDelete).not.toHaveBeenCalled();
        expect(state.messageEpoch).toBe(1);
    });

    it('rejects an old retry after a newer clear has replaced its completion receipt', async () => {
        const state = clearingState();
        const operation = { id: 'older-clear' };
        await sessionService.clearMessages('session-123', operation);
        await sessionService.clearMessages('session-123', { id: 'newer-clear' });
        vi.mocked(getDocsFromServer).mockClear();
        await expect(sessionService.clearMessages('session-123', operation)).rejects.toThrow('superseded');
        expect(getDocsFromServer).not.toHaveBeenCalled();
        expect(state).toMatchObject({ messageEpoch: 2, lastClearedOperation: 'newer-clear' });
    });

    it('rejects a superseded clear before deleting its stale page', async () => {
        const state = clearingState();
        vi.mocked(getDocsFromServer).mockImplementationOnce(async () => {
            Object.assign(state, { messageEpoch: 2, clearingOperation: null });
            return { empty: false, docs: [{ ref: { path: 'messages/new' } }] } as unknown as Awaited<ReturnType<typeof getDocsFromServer>>;
        });
        await expect(sessionService.clearMessages('session-123')).rejects.toThrow('superseded');
        expect(firestoreMocks.transactionDelete).not.toHaveBeenCalled();
        expect(state.messageEpoch).toBe(2);
    });

    it('rejects an append started before a completed cross-device clear', async () => {
        firestoreMocks.serverGet.mockResolvedValue({ exists: () => true, data: () => ({ messageEpoch: 0 }) });
        firestoreMocks.transactionGet.mockResolvedValue({ exists: () => true, data: () => ({ messageEpoch: 1, messages: [], messageStorage: 'subcollection' }) });
        await expect(sessionService.appendMessage('session-123', { id: 'late', role: 'user', text: 'late', timestamp: 2 })).rejects.toThrow('cleared');
        expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
    });

    it('keeps a retried append bound to its original generation after a lost write acknowledgement', async () => {
        const message = { id: 'retry', role: 'user' as const, text: 'Do not resurrect', timestamp: 2 };
        firestoreMocks.runTransaction.mockRejectedValueOnce(new Error('acknowledgement lost'));
        await expect(sessionService.appendMessage('session-123', message)).rejects.toThrow('acknowledgement lost');
        firestoreMocks.serverGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ messageEpoch: 1 }) });
        await expect(sessionService.appendMessage('session-123', message)).rejects.toThrow('cleared before');
        expect(firestoreMocks.runTransaction).toHaveBeenCalledTimes(1);
    });

    it('rejects uploads before starting when the parent is already clearing', async () => {
        firestoreMocks.serverGet.mockResolvedValue({ exists: () => true, data: () => ({ messageEpoch: 1, clearingOperation: 'active' }) });
        await expect(sessionService.appendMessage('session-123', { id: 'late', role: 'user', text: 'late', timestamp: 2, attachments: [{ mimeType: 'image/png', base64: 'AAEC' }] })).rejects.toThrow('being cleared');
        expect(firestoreMocks.storeAttachments).not.toHaveBeenCalled();
    });

    it('does not edit a stale message from a prior generation', async () => {
        firestoreMocks.serverGet.mockResolvedValue({ exists: () => true, data: () => ({ messageEpoch: 1 }) });
        firestoreMocks.transactionGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ messageEpoch: 1 }) })
            .mockResolvedValueOnce({ exists: () => true, data: () => ({ messageEpoch: 0 }) });
        await expect(sessionService.updateMessage('session-123', 'old', { text: 'late edit' })).rejects.toThrow('current conversation generation');
        expect(firestoreMocks.transactionUpdate).not.toHaveBeenCalled();
    });
});
