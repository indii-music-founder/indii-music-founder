import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectCanvasPersistence, type CanvasFullState } from '../services/ProjectCanvasPersistence';
import { InfiniteCanvasAdapter } from '../adapters/InfiniteCanvasAdapter';
import { EntityResolver } from '../resolvers/EntityResolver';
import { useStore } from '@/core/store';
import type { CanvasImage } from '@/core/store/slices/creative/creativeHistorySlice';
import type { ProjectCanvasBlock, ProjectCanvasDocument } from '../types';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'artist_user_1' } },
    db: {},
}));

const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((...args) => ({ path: args.join('/') })),
    doc: vi.fn((...args) => ({ path: args.join('/') })),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: mockBatchSet,
        delete: mockBatchDelete,
        commit: mockBatchCommit,
    })),
    serverTimestamp: vi.fn(() => 1700000000000),
}));

describe('Project Canvas Phase 1 Acceptance Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Criterion 1: Create blocks, reload, see same blocks in same positions ──
    it('Criterion 1: Created blocks survive reload and maintain positions', async () => {
        const projectId = 'proj_session_1';
        const canvasId = `canvas_${projectId}`;

        const blockA: ProjectCanvasBlock = {
            id: 'block_a',
            type: 'text',
            canvasId,
            projectId,
            position: { x: 120, y: 340 },
            size: { width: 300, height: 200 },
            zIndex: 1,
            snapshot: { title: 'Hook Melody Idea', cachedAt: 1700000000000 },
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
        };

        const doc: ProjectCanvasDocument = {
            id: canvasId,
            schemaVersion: 1,
            projectId,
            ownerId: 'artist_user_1',
            title: 'Project Canvas',
            viewport: { x: 50, y: 25, zoom: 1.2 },
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
            revision: 1,
            blockIds: ['block_a'],
            edgeIds: [],
        };

        const fullState: CanvasFullState = {
            document: doc,
            blocks: [blockA],
            edges: [],
        };

        // Persist
        await ProjectCanvasPersistence.saveCanvas(fullState);

        // Simulate reload: load canvas from persistence
        const reloaded = await ProjectCanvasPersistence.loadCanvas(projectId);
        expect(reloaded.document.projectId).toBe(projectId);
        expect(reloaded.document.viewport).toEqual({ x: 50, y: 25, zoom: 1.2 });
        expect(reloaded.blocks).toHaveLength(1);
        expect(reloaded.blocks[0].id).toBe('block_a');
        expect(reloaded.blocks[0].position).toEqual({ x: 120, y: 340 });
    });

    // ── Criterion 2: Switch between two projects without leakage ────────────
    it('Criterion 2: Repeatedly switching between projects exhibits zero data leakage', async () => {
        const stateAlpha: CanvasFullState = {
            document: {
                id: 'canvas_proj_alpha',
                schemaVersion: 1,
                projectId: 'proj_alpha',
                ownerId: 'artist_user_1',
                title: 'Alpha Album',
                viewport: { x: 0, y: 0, zoom: 1 },
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                revision: 1,
                blockIds: ['block_alpha_1'],
                edgeIds: [],
            },
            blocks: [{
                id: 'block_alpha_1',
                type: 'text',
                canvasId: 'canvas_proj_alpha',
                projectId: 'proj_alpha',
                position: { x: 10, y: 10 },
                size: { width: 100, height: 100 },
                zIndex: 1,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
            }],
            edges: [],
        };

        const stateBeta: CanvasFullState = {
            document: {
                id: 'canvas_proj_beta',
                schemaVersion: 1,
                projectId: 'proj_beta',
                ownerId: 'artist_user_1',
                title: 'Beta Tour',
                viewport: { x: 100, y: 200, zoom: 0.8 },
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                revision: 1,
                blockIds: ['block_beta_1'],
                edgeIds: [],
            },
            blocks: [{
                id: 'block_beta_1',
                type: 'asset',
                canvasId: 'canvas_proj_beta',
                projectId: 'proj_beta',
                position: { x: 500, y: 300 },
                size: { width: 300, height: 300 },
                zIndex: 1,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
            }],
            edges: [],
        };

        ProjectCanvasPersistence.saveToLocalBackup('proj_alpha', stateAlpha);
        ProjectCanvasPersistence.saveToLocalBackup('proj_beta', stateBeta);

        // Load Alpha
        const alpha = await ProjectCanvasPersistence.loadCanvas('proj_alpha');
        expect(alpha.blocks.map(b => b.id)).toEqual(['block_alpha_1']);
        expect(alpha.blocks.some(b => b.projectId === 'proj_beta')).toBe(false);

        // Load Beta
        const beta = await ProjectCanvasPersistence.loadCanvas('proj_beta');
        expect(beta.blocks.map(b => b.id)).toEqual(['block_beta_1']);
        expect(beta.blocks.some(b => b.projectId === 'proj_alpha')).toBe(false);

        // Switch back to Alpha
        const alphaReturn = await ProjectCanvasPersistence.loadCanvas('proj_alpha');
        expect(alphaReturn.blocks.map(b => b.id)).toEqual(['block_alpha_1']);
        expect(alphaReturn.blocks.some(b => b.id === 'block_beta_1')).toBe(false);
    });

    // ── Criterion 3: Save race condition ────────────────────────────────────
    it('Criterion 3: Newer edits during in-flight save keep canvas visibly dirty', async () => {
        const state: CanvasFullState = {
            document: {
                id: 'canvas_race_test',
                schemaVersion: 1,
                projectId: 'proj_race',
                ownerId: 'artist_user_1',
                title: 'Race Test',
                viewport: { x: 0, y: 0, zoom: 1 },
                createdAt: 1000,
                updatedAt: 1000,
                revision: 0,
                blockIds: [],
                edgeIds: [],
            },
            blocks: [],
            edges: [],
        };

        ProjectCanvasPersistence.bumpMutationVersion();

        mockBatchCommit.mockImplementationOnce(async () => {
            // User drags another card while the network request is still pending:
            ProjectCanvasPersistence.bumpMutationVersion();
        });

        const result = await ProjectCanvasPersistence.saveCanvas(state);
        // Because a newer mutation was registered, clearedDirty must be false
        expect(result.clearedDirty).toBe(false);
    });

    // ── Criterion 4: Firestore failure preserves local work ─────────────────
    it('Criterion 4: Network failure leaves local state intact in memory and local backup', async () => {
        const state: CanvasFullState = {
            document: {
                id: 'canvas_fail_test',
                schemaVersion: 1,
                projectId: 'proj_fail',
                ownerId: 'artist_user_1',
                title: 'Fail Test',
                viewport: { x: 0, y: 0, zoom: 1 },
                createdAt: 1000,
                updatedAt: 1000,
                revision: 0,
                blockIds: ['b1'],
                edgeIds: [],
            },
            blocks: [{
                id: 'b1',
                type: 'text',
                canvasId: 'canvas_fail_test',
                projectId: 'proj_fail',
                position: { x: 100, y: 100 },
                size: { width: 200, height: 100 },
                zIndex: 1,
                createdAt: 1000,
                updatedAt: 1000,
            }],
            edges: [],
        };

        mockBatchCommit.mockRejectedValueOnce(new Error('Simulated network failure'));

        await expect(ProjectCanvasPersistence.saveCanvas(state)).rejects.toThrow('Simulated network failure');

        // Verify that despite cloud error, the local backup exists and has the full block!
        const backup = ProjectCanvasPersistence.loadFromLocalBackup('proj_fail');
        expect(backup).not.toBeNull();
        expect(backup?.blocks).toHaveLength(1);
        expect(backup?.blocks[0].id).toBe('b1');
    });

    // ── Criterion 5 & 6: Asset drag and Creative Editor integration ─────────
    it('Criterion 5 & 6: Legacy CanvasImage adapts into asset block and retains lineage', () => {
        const legacyImages: CanvasImage[] = [
            {
                id: 'img_parent',
                base64: 'https://storage.googleapis.com/test-bucket/master.png',
                x: 100,
                y: 100,
                width: 400,
                height: 400,
                aspect: 1,
                projectId: 'proj_1',
                prompt: 'Master album visual',
            },
            {
                id: 'img_derived',
                base64: 'https://storage.googleapis.com/test-bucket/crop.png',
                x: 550,
                y: 100,
                width: 200,
                height: 200,
                aspect: 1,
                projectId: 'proj_1',
                parentId: 'img_parent',
                prompt: 'Crop detail',
            },
        ];

        const { blocks, edges } = InfiniteCanvasAdapter.convertLegacyImages(
            legacyImages,
            'canvas_proj_1',
            'proj_1'
        );

        expect(blocks).toHaveLength(2);
        expect(blocks[0].id).toBe('block_legacy_img_parent');
        expect(blocks[1].id).toBe('block_legacy_img_derived');

        // Verify lineage edge was created between parent and child!
        expect(edges).toHaveLength(1);
        expect(edges[0].relationship).toBe('lineage');
        expect(edges[0].sourceBlockId).toBe('block_legacy_img_parent');
        expect(edges[0].targetBlockId).toBe('block_legacy_img_derived');
    });

    // ── Criterion 7: Remove block placement does not delete canonical record ─
    it('Criterion 7: Removing canvas placement removes block without deleting canonical note', async () => {
        const canonicalNote = {
            id: 'note_canonical_999',
            title: 'Irreplaceable Song Lyrics',
            content: 'Verse 1: Lights in the rain...',
            attachments: [],
            tags: ['lyrics'],
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
        };

        // Note lives in the Notes store
        useStore.setState({
            notes: [canonicalNote],
        });

        // Resolve note on canvas
        const resolved = await EntityResolver.resolve({
            kind: 'note',
            entityId: canonicalNote.id,
        });
        expect(resolved.status).toBe('resolved');

        // Delete canvas placement
        await ProjectCanvasPersistence.deleteBlockPlacement('proj_1', 'canvas_proj_1', 'block_note_card');

        // Assert canonical note is still fully present in Notes store!
        const notesAfter = useStore.getState().notes;
        expect(notesAfter.find(n => n.id === canonicalNote.id)).toBeDefined();
        expect(notesAfter.find(n => n.id === canonicalNote.id)?.title).toBe('Irreplaceable Song Lyrics');
    });

    // ── Criterion 10: No base64 media payload in canvas records ─────────────
    it('Criterion 10: Enforces that persisted block records do not store base64 media', () => {
        const legacyBase64Image: CanvasImage = {
            id: 'img_heavy',
            base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'proj_1',
            prompt: 'Heavy raster',
        };

        const { blocks } = InfiniteCanvasAdapter.convertLegacyImages(
            [legacyBase64Image],
            'canvas_proj_1',
            'proj_1'
        );

        expect(blocks).toHaveLength(1);
        // The snapshot must NOT store the base64 string!
        expect(blocks[0].snapshot?.thumbnailUrl).toBeUndefined();
        expect(JSON.stringify(blocks[0])).not.toContain('data:image/png;base64');
    });
});
