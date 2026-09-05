import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as opentype from 'opentype.js';

// --- Firebase in-memory mock ------------------------------------------------

const store = new Map<string, Record<string, unknown>>();
const storageBlobs = new Map<string, string>();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user_test' } },
    db: {},
    storage: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: (_db: unknown, ...segs: string[]) => ({ __path: segs.join('/') }),
    doc: (c: { __path: string }, id: string) => ({ __path: `${c.__path}/${id}` }),
    setDoc: vi.fn(async (ref: { __path: string }, data: Record<string, unknown>) => { store.set(ref.__path, data); }),
    getDoc: vi.fn(async (ref: { __path: string }) => {
        const data = store.get(ref.__path);
        return { exists: () => !!data, data: () => data };
    }),
    deleteDoc: vi.fn(async (ref: { __path: string }) => {
        store.delete(ref.__path);
    }),
    getDocs: vi.fn(async (q: { __coll: { __path: string } }) => {
        const prefix = `${q.__coll.__path}/`;
        const docs = [...store.entries()].filter(([k]) => k.startsWith(prefix))
            .map(([k, data]) => ({ id: k.slice(prefix.length), data: () => data }))
            .sort((a, b) => Number((b.data() as { addedAt: number }).addedAt) - Number((a.data() as { addedAt: number }).addedAt));
        return { docs };
    }),
    query: (coll: { __path: string }, ..._a: unknown[]) => ({ __coll: coll }),
    orderBy: (..._a: unknown[]) => ({}),
}));

vi.mock('firebase/storage', () => ({
    ref: (_s: unknown, path: string) => ({ __path: path }),
    uploadString: vi.fn(async (r: { __path: string }, dataUrl: string) => { storageBlobs.set(r.__path, dataUrl); }),
    getDownloadURL: vi.fn(async (r: { __path: string }) => `https://storage.test/${r.__path}`),
    deleteObject: vi.fn(async () => undefined),
}));

import { FontLibrary } from '../FontLibrary';

// Build a real, parseable TTF from opentype.js so registerFont's parse() works.
function buildFontBuffer(): ArrayBuffer {
    const box = (name: string, unicode: number, adv: number, w = 500, h = 700) => {
        const p = new opentype.Path();
        p.moveTo(0, 0); p.lineTo(w, 0); p.lineTo(w, h); p.lineTo(0, h); p.close();
        return new opentype.Glyph({ name, unicode, advanceWidth: adv, path: p });
    };
    const glyphs = [box('D', 68, 650), box('i', 105, 250, 80), box('space', 32, 250, 0, 0)];
    glyphs[2] = new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() });
    const f = new opentype.Font({ familyName: 'Dii', styleName: 'Regular', unitsPerEm: 1000, ascender: 900, descender: -100, glyphs });
    f.kerningPairs = {};
    return f.toArrayBuffer() as ArrayBuffer;
}

async function fileFrom(buf: ArrayBuffer, name: string, type = 'font/ttf'): Promise<File> {
    const file = new File([buf], name, { type });
    // Ensure arrayBuffer() exists on this environment's File (jsdom/Node gap).
    const f = file as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof f.arrayBuffer !== 'function') {
        Object.defineProperty(file, 'arrayBuffer', { value: async () => buf });
    }
    return file;
}

describe('FontLibrary (B1.1 — mocked Firebase)', () => {
    beforeEach(() => {
        store.clear();
        storageBlobs.clear();
        vi.clearAllMocks();
    });

    it('registers, persists, and lists a valid font with the right format', async () => {
        const file = await fileFrom(buildFontBuffer(), 'diitest.ttf', 'font/ttf');
        const meta = await FontLibrary.registerFont(file);

        expect(meta.id).toMatch(/^font_/);
        expect(meta.format).toBe('ttf');
        expect(meta.storageRef).toContain('brandKit/fonts');
        // Persisted to Firestore + Storage.
        expect(store.size).toBe(1);
        expect(storageBlobs.size).toBe(1);

        const listed = await FontLibrary.listFonts();
        expect(listed).toHaveLength(1);
        expect(listed[0]!.id).toBe(meta.id);
    });

    it('loads a working opentype.Font back from storage', async () => {
        const file = await fileFrom(buildFontBuffer(), 'diitest.ttf', 'font/ttf');
        const meta = await FontLibrary.registerFont(file);

        const origFetch = globalThis.fetch;
        const buf = buildFontBuffer();
        (globalThis as { fetch: unknown }).fetch = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => buf })) as unknown as typeof fetch;

        try {
            const font = await FontLibrary.loadOpenTypeFont(meta.id);
            expect(font).toBeDefined();
            expect(font.getAdvanceWidth('D', 100)).toBeCloseTo(65, 6);
        } finally {
            (globalThis as { fetch: unknown }).fetch = origFetch;
        }
    });

    it('registers, persists, and loads an .otf font correctly without falling back to .ttf', async () => {
        const file = await fileFrom(buildFontBuffer(), 'diitest.otf', 'font/otf');
        const meta = await FontLibrary.registerFont(file);

        expect(meta.format).toBe('otf');
        expect(meta.storageRef).toContain('.otf');

        const origFetch = globalThis.fetch;
        const buf = buildFontBuffer();
        (globalThis as { fetch: unknown }).fetch = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => buf })) as unknown as typeof fetch;

        try {
            const font = await FontLibrary.loadOpenTypeFont(meta.id);
            expect(font).toBeDefined();
            expect(font.getAdvanceWidth('D', 100)).toBeCloseTo(65, 6);
        } finally {
            (globalThis as { fetch: unknown }).fetch = origFetch;
        }
    });

    it('deletes font removing both storage blob and firestore metadata', async () => {
        const file = await fileFrom(buildFontBuffer(), 'delete_me.otf', 'font/otf');
        const meta = await FontLibrary.registerFont(file);

        expect(store.size).toBe(1);
        await FontLibrary.deleteFont(meta.id);

        expect(store.size).toBe(0);
        const listed = await FontLibrary.listFonts();
        expect(listed).toHaveLength(0);
    });

    it('rejects .woff2 with an actionable "convert" error (B1.3)', async () => {
        const buf = buildFontBuffer();
        const file = await fileFrom(buf, 'diitest.woff2', 'font/woff2');
        await expect(FontLibrary.registerFont(file)).rejects.toThrow(/WOFF2 fonts are not supported/i);
    });

    it('rejects unsupported extensions and oversized files', async () => {
        const buf = buildFontBuffer();
        await expect(FontLibrary.registerFont(await fileFrom(buf, 'font.pdf', 'application/pdf'))).rejects.toThrow(/Unsupported font extension/);
        const big = new File([new Uint8Array(9 * 1024 * 1024)], 'big.ttf', { type: 'font/ttf' });
        await expect(FontLibrary.registerFont(big)).rejects.toThrow(/too large/);
    });
});
