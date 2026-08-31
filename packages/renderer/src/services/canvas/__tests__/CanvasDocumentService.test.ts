import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocFromImage } from '../CanvasDoc';

const backingStore = new Map<string, unknown>();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'u1' } },
    db: { __mocked: true },
}));

vi.mock('firebase/firestore', () => {
    const docRef = (id: string) => ({ __path: id });
    return {
        collection: vi.fn(() => ({ __coll: true })),
        doc: vi.fn((_coll: unknown, id: string) => docRef(id)),
        setDoc: vi.fn(async (ref: { __path: string }, data: unknown) => {
            backingStore.set(ref.__path, data);
        }),
        getDoc: vi.fn(async (ref: { __path: string }) => {
            const data = backingStore.get(ref.__path);
            return data === undefined
                ? { exists: () => false }
                : { exists: () => true, data: () => data };
        }),
        getDocs: vi.fn(async () => ({
            docs: [...backingStore.values()].map((data) => ({ data: () => data })),
        })),
        query: vi.fn((coll: unknown) => coll),
        where: vi.fn(() => ({ __where: true })),
    };
});

import { CanvasDocumentService } from '../CanvasDocumentService';

describe('CanvasDocumentService (C1.5 autosave round-trip)', () => {
    beforeEach(() => {
        backingStore.clear();
    });

    it('round-trips a doc through storage and back', async () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        await CanvasDocumentService.saveDoc(doc);

        const loaded = await CanvasDocumentService.loadDoc(doc.id);

        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(doc.id);
        expect(loaded!.projectId).toBe('proj_1');
        expect(loaded!.layers).toHaveLength(1);
        expect(loaded!.layers[0]).toMatchObject({ kind: 'raster', src: 'data:image/png;base64,AAA', name: 'Background' });
    });

    it('returns null for a missing document', async () => {
        const loaded = await CanvasDocumentService.loadDoc('doc_does_not_exist');
        expect(loaded).toBeNull();
    });

    it('lists project docs newest-first', async () => {
        // Seed the backing store directly so `updatedAt` is deterministic
        // (saveDoc stamps Date.now(), which cannot drive a stable sort order).
        backingStore.set('doc_old', { id: 'doc_old', projectId: 'proj_1', updatedAt: 100, layers: [] });
        backingStore.set('doc_new', { id: 'doc_new', projectId: 'proj_1', updatedAt: 200, layers: [] });

        const docs = await CanvasDocumentService.listDocs('proj_1');

        expect(docs.map((d) => d.id)).toEqual(['doc_new', 'doc_old']);
    });
});
