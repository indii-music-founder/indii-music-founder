import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectCanvasPersistence, type CanvasFullState } from '../services/ProjectCanvasPersistence';
import type { ProjectCanvasBlock, ProjectCanvasDocument } from '../types';

// Mock firebase
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test_user_uid' } },
    db: {},
}));

// Mock firestore functions
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((...args) => ({ path: args.join('/') })),
    doc: vi.fn((...args) => ({ path: args.join('/') })),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: mockSet,
        delete: mockDelete,
        commit: mockCommit,
    })),
    serverTimestamp: vi.fn(() => 1700000000000),
}));

describe('ProjectCanvasPersistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    const createMockState = (projectId: string): CanvasFullState => {
        const doc: ProjectCanvasDocument = {
            id: `canvas_${projectId}`,
            schemaVersion: 1,
            projectId,
            ownerId: 'test_user_uid',
            title: `Canvas ${projectId}`,
            viewport: { x: 0, y: 0, zoom: 1 },
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
            revision: 0,
            blockIds: ['block_1'],
            edgeIds: [],
        };

        const block: ProjectCanvasBlock = {
            id: 'block_1',
            type: 'text',
            canvasId: `canvas_${projectId}`,
            projectId,
            position: { x: 100, y: 100 },
            size: { width: 200, height: 100 },
            zIndex: 1,
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
        };

        return {
            document: doc,
            blocks: [block],
            edges: [],
        };
    };

    it('manages monotonic mutation versions', () => {
        const v1 = ProjectCanvasPersistence.bumpMutationVersion();
        const v2 = ProjectCanvasPersistence.bumpMutationVersion();
        expect(v2).toBe(v1 + 1);
        expect(ProjectCanvasPersistence.getMutationVersion()).toBe(v2);
    });

    it('clears dirty state when no concurrent edit happens during save', async () => {
        const state = createMockState('project_alpha');
        ProjectCanvasPersistence.bumpMutationVersion();

        const result = await ProjectCanvasPersistence.saveCanvas(state);
        expect(result.clearedDirty).toBe(true);
        expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('preserves dirty state when a user mutates while save is in flight (save race condition)', async () => {
        const state = createMockState('project_alpha');
        ProjectCanvasPersistence.bumpMutationVersion();

        // Simulate concurrent mutation occurring before save resolves
        mockCommit.mockImplementationOnce(async () => {
            // User moves another card while save is in-flight:
            ProjectCanvasPersistence.bumpMutationVersion();
        });

        const result = await ProjectCanvasPersistence.saveCanvas(state);
        expect(result.clearedDirty).toBe(false);
    });

    it('recovers state from local backup when Firestore load is unavailable', async () => {
        const state = createMockState('project_beta');
        ProjectCanvasPersistence.saveToLocalBackup('project_beta', state);

        const loaded = await ProjectCanvasPersistence.loadCanvas('project_beta');
        expect(loaded.document.projectId).toBe('project_beta');
        expect(loaded.blocks).toHaveLength(1);
        expect(loaded.blocks[0].id).toBe('block_1');
    });

    it('isolates state strictly between two different projects', async () => {
        const stateA = createMockState('project_A');
        const stateB = createMockState('project_B');
        stateB.blocks[0].id = 'block_in_b';

        ProjectCanvasPersistence.saveToLocalBackup('project_A', stateA);
        ProjectCanvasPersistence.saveToLocalBackup('project_B', stateB);

        const loadedA = await ProjectCanvasPersistence.loadCanvas('project_A');
        const loadedB = await ProjectCanvasPersistence.loadCanvas('project_B');

        expect(loadedA.document.projectId).toBe('project_A');
        expect(loadedA.blocks[0].id).toBe('block_1');

        expect(loadedB.document.projectId).toBe('project_B');
        expect(loadedB.blocks[0].id).toBe('block_in_b');
        expect(loadedA.blocks[0].id).not.toBe(loadedB.blocks[0].id);
    });
});
