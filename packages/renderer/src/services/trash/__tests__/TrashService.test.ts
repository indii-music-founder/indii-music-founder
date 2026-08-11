import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrashService, FileNodeTrashAdapter } from '../TrashService';
import { TrashTarget, TrashProvenance } from '@indii/shared';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { desktopFileIndexService } from '@/services/agent/DesktopFileIndexService';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'usr_test_123' } },
    db: {},
    functions: {},
}));

const createIntentMock = vi.fn();
const executePurgeMock = vi.fn();

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn((_functions, name: string) => {
        if (name === 'createPurgeIntent') return createIntentMock;
        if (name === 'purgeTrashItems') return executePurgeMock;
        throw new Error(`Unexpected callable: ${name}`);
    }),
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn((_db, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(),
    writeBatch: vi.fn(() => ({
        update: vi.fn(),
        set: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
    })),
}));

vi.mock('@/services/agent/DesktopFileIndexService', () => ({
    desktopFileIndexService: {
        moveToTrash: vi.fn(() => Promise.resolve({
            success: true,
            name: 'vocal.wav',
            sizeBytes: 1024,
            isDirectory: false,
        })),
        restoreFromTrash: vi.fn(() => Promise.resolve({
            success: true,
            restoredPath: 'vocal.wav',
        })),
        purgeFromTrash: vi.fn(() => Promise.resolve({
            success: true,
            purgedTrashId: 'trash_001',
        })),
    },
}));

describe('TrashService & Adapters', () => {
    let trashService: TrashService;

    beforeEach(() => {
        trashService = new TrashService();
        vi.clearAllMocks();
        createIntentMock.mockResolvedValue({
            data: {
                success: true,
                intentToken: 'intent_0123456789abcdef0123456789abcdef',
                expiresAt: Date.now() + 300_000,
            },
        });
        executePurgeMock.mockResolvedValue({
            data: {
                success: true,
                purgedIds: ['trash_001'],
                failedIds: [],
            },
        });
    });

    it('successfully handles LocalFileTrashAdapter move to trash', async () => {
        const target: TrashTarget = {
            type: 'local_files',
            targetId: 'stems/vocal.wav',
            folderId: 'folder_root_1',
        };
        const provenance: TrashProvenance = {
            actor: 'user',
            reason: 'User requested file removal in Studio',
        };

        const result = await trashService.moveToTrash(target, provenance, 'proj_1');
        expect(result.type).toBe('local_files');
        expect(result.name).toBe('vocal.wav');
        expect(result.provenance.actor).toBe('user');
        expect(result.projectId).toBe('proj_1');
    });

    it('prevents trashing when resource is retention locked', async () => {
        const fileNodeAdapter = new FileNodeTrashAdapter();
        vi.spyOn(fileNodeAdapter, 'inspect').mockResolvedValueOnce({
            name: 'LockedRelease.wav',
            originalLocation: 'fileNodes/fn_locked',
            sizeBytes: 1024,
            mimeType: 'audio/wav',
            isRetentionLocked: true,
            lockReason: 'Item is bound to an active distributed release',
            restoreData: {},
        });

        const target: TrashTarget = {
            type: 'file_nodes',
            targetId: 'fn_locked',
        };
        const provenance: TrashProvenance = { actor: 'agent', agentId: 'music_agent' };

        await expect(fileNodeAdapter.trash('trash_99', target, provenance)).rejects.toThrow(
            'Cannot move to trash: Item is bound to an active distributed release'
        );
    });

    it('reads file nodes from the canonical root collection and verifies ownership', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ userId: 'usr_test_123', name: 'mix.wav' }),
        } as never);
        const adapter = new FileNodeTrashAdapter();
        await expect(adapter.inspect({ type: 'file_nodes', targetId: 'fn_1' })).resolves.toMatchObject({ name: 'mix.wav' });
        expect(doc).toHaveBeenCalledWith({}, 'file_nodes', 'fn_1');
    });

    it('atomically commits a cloud source mutation with its Trash manifest', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ userId: 'usr_test_123', name: 'mix.wav', projectId: 'project-1' }),
        } as never);
        await trashService.moveToTrash(
            { type: 'file_nodes', targetId: 'fn_2' },
            { actor: 'user', reason: 'remove draft' },
        );
        expect(writeBatch).toHaveBeenCalledTimes(1);
        expect(setDoc).not.toHaveBeenCalled();
    });

    it('does not create duplicate manifests for a source already in Trash', async () => {
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ userId: 'usr_test_123', name: 'mix.wav', isTrashed: true }),
        } as never);
        await expect(trashService.moveToTrash(
            { type: 'file_nodes', targetId: 'fn_trashed' },
            { actor: 'agent', agentId: 'generalist' },
        )).rejects.toThrow('already in Trash');
        expect(writeBatch).not.toHaveBeenCalled();
    });

    it('rolls a local move back when the cloud manifest cannot be persisted', async () => {
        vi.mocked(setDoc).mockRejectedValueOnce(new Error('offline write failed'));
        await expect(trashService.moveToTrash({
            type: 'local_files',
            targetId: 'stems/vocal.wav',
            folderId: 'folder_root_1',
        }, { actor: 'user' })).rejects.toThrow('offline write failed');
        expect(desktopFileIndexService.restoreFromTrash).toHaveBeenCalledTimes(1);
    });

    it('validates purge requests and callable responses behind the service boundary', async () => {
        await expect(trashService.permanentlyPurge(['trash_001'])).resolves.toEqual({
            success: true,
            purgedIds: ['trash_001'],
            failedIds: [],
        });
        expect(httpsCallable).toHaveBeenCalledWith({}, 'createPurgeIntent');
        expect(createIntentMock).toHaveBeenCalledWith({
            trashIds: ['trash_001'],
            confirmation: 'DELETE',
        });
        expect(executePurgeMock).toHaveBeenCalledWith({
            trashIds: ['trash_001'],
            intentToken: 'intent_0123456789abcdef0123456789abcdef',
        });
    });

    it('rejects malformed trash IDs before invoking a purge callable', async () => {
        await expect(trashService.permanentlyPurge(['../outside'])).rejects.toThrow(
            'Trash ID must use the canonical trash_<id> format'
        );
        expect(httpsCallable).not.toHaveBeenCalled();
    });
});
