import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrashService, FileNodeTrashAdapter, LocalFileTrashAdapter } from '../TrashService';
import { TrashTarget, TrashProvenance } from '@indii/shared';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { desktopFileIndexService } from '@/services/agent/DesktopFileIndexService';

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'usr_test_123' } },
    db: {},
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

    it('rolls a local move back when the cloud manifest cannot be persisted', async () => {
        vi.mocked(setDoc).mockRejectedValueOnce(new Error('offline write failed'));
        await expect(trashService.moveToTrash({
            type: 'local_files',
            targetId: 'stems/vocal.wav',
            folderId: 'folder_root_1',
        }, { actor: 'user' })).rejects.toThrow('offline write failed');
        expect(desktopFileIndexService.restoreFromTrash).toHaveBeenCalledTimes(1);
    });
});
