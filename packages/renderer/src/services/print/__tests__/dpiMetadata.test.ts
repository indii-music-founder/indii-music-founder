import { describe, expect, it } from 'vitest';
import {
    applyDpiMetadata,
    crc32,
    dataUrlWithDpi,
    injectJpegDpi,
    injectPngDpi,
} from '../dpiMetadata';

// ---------------------------------------------------------------------------
// Fixtures — byte-exact, built in-test so the module is verified against
// its own containers, not a mock canvas.
// ---------------------------------------------------------------------------

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + payload.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, payload.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(payload, 8);
    const crcInput = new Uint8Array(4 + payload.length);
    for (let i = 0; i < 4; i++) crcInput[i] = out[4 + i];
    crcInput.set(payload, 4);
    view.setUint32(8 + payload.length, crc32(crcInput));
    return out;
}

function ihdrPayload(): Uint8Array {
    const p = new Uint8Array(13);
    const v = new DataView(p.buffer);
    v.setUint32(0, 3713);
    v.setUint32(4, 3713);
    p[8] = 8;  // bit depth
    p[9] = 6;  // RGBA
    return p;
}

function makePng(withPhYs = false): Uint8Array {
    const parts: Uint8Array[] = [PNG_SIG, pngChunk('IHDR', ihdrPayload())];
    if (withPhYs) {
        const stale = new Uint8Array(9);
        stale[8] = 1;
        parts.push(pngChunk('pHYs', stale)); // stale 0-ppm pHYs to be replaced
    }
    parts.push(pngChunk('IDAT', Uint8Array.from([0x78, 0x9c, 0x03, 0x00, 0x01, 0x02, 0x03])));
    parts.push(pngChunk('IEND', new Uint8Array(0)));
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
}

function walkChunks(data: Uint8Array): { type: string; data: Uint8Array; crc: number; raw: Uint8Array }[] {
    const chunks: { type: string; data: Uint8Array; crc: number; raw: Uint8Array }[] = [];
    let off = 8;
    while (off + 12 <= data.length) {
        const v = new DataView(data.buffer, data.byteOffset + off, 8);
        const len = v.getUint32(0);
        const type = String.fromCharCode(data[off + 4], data[off + 5], data[off + 6], data[off + 7]);
        // CRC is read byte-directly — the view only covers the length field.
        const crc = ((data[off + 8 + len] << 24) | (data[off + 9 + len] << 16) | (data[off + 10 + len] << 8) | data[off + 11 + len]) >>> 0;
        chunks.push({
            type,
            data: data.slice(off + 8, off + 8 + len),
            crc,
            raw: data.slice(off, off + 12 + len),
        });
        off += 12 + len;
    }
    return chunks;
}

function makeJpegWithJfif(units = 0, xd = 1, yd = 1): Uint8Array {
    const seg = Uint8Array.from([
        0xff, 0xe0, 0x00, 0x10,
        0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
        0x01, 0x01,                   // version 1.01
        units, (xd >> 8) & 0xff, xd & 0xff, (yd >> 8) & 0xff, yd & 0xff,
        0x00, 0x00,                   // no thumbnail
    ]);
    const dqt = Uint8Array.from([0xff, 0xdb, 0x00, 0x03, 0x01, 0x02, 0x03]);
    const out = new Uint8Array(2 + seg.length + dqt.length);
    out.set([0xff, 0xd8], 0);
    out.set(seg, 2);
    out.set(dqt, 2 + seg.length);
    return out;
}

// ---------------------------------------------------------------------------
// CRC32
// ---------------------------------------------------------------------------

describe('crc32', () => {
    it('matches the IEEE 802.3 check vector', () => {
        // Standard test: CRC32("123456789") = 0xCBF43926
        expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    });
});

// ---------------------------------------------------------------------------
// PNG pHYs
// ---------------------------------------------------------------------------

describe('injectPngDpi', () => {
    it('inserts exactly one pHYs after IHDR with the correct metres-per-DPI CRC', () => {
        const out = injectPngDpi(makePng(), 300);
        const chunks = walkChunks(out);
        expect(chunks.map(c => c.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);

        const phys = chunks[1];
        const v = new DataView(phys.data.buffer);
        const expectedPpm = Math.round(300 / 0.0254);
        expect(v.getUint32(0)).toBe(expectedPpm);
        expect(v.getUint32(4)).toBe(expectedPpm);
        expect(phys.data[8]).toBe(1); // unit: metre

        // Stored CRC must verify over type+data.
        const crcInput = new Uint8Array(4 + phys.data.length);
        for (let i = 0; i < 4; i++) crcInput[i] = phys.raw[4 + i];
        crcInput.set(phys.data, 4);
        expect(phys.crc).toBe(crc32(crcInput));
    });

    it('replaces a stale pHYs instead of stacking a second one', () => {
        const out = injectPngDpi(makePng(true), 300);
        const types = walkChunks(out).map(c => c.type);
        expect(types.filter(t => t === 'pHYs')).toHaveLength(1);
    });

    it('leaves IDAT payload bytes untouched', () => {
        const before = walkChunks(makePng()).find(c => c.type === 'IDAT')!.data;
        const after = walkChunks(injectPngDpi(makePng(), 600)).find(c => c.type === 'IDAT')!.data;
        expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
    });

    it('rejects non-PNG streams, missing IHDR, and non-positive DPI', () => {
        expect(() => injectPngDpi(new Uint8Array([1, 2, 3]), 300)).toThrow(/not a PNG/);
        expect(() => injectPngDpi(makePng(), 0)).toThrow(/positive/);
        // Signature followed by a valid chunk that is not IHDR (tEXt: 12 + 5 bytes).
        const bad = new Uint8Array(PNG_SIG.length + 17);
        bad.set(PNG_SIG, 0);
        bad.set(pngChunk('tEXt', Uint8Array.from([0x61, 0x62, 0x63, 0x64, 0x65])), PNG_SIG.length);
        expect(() => injectPngDpi(bad, 300)).toThrow(/IHDR/);
    });
});

// ---------------------------------------------------------------------------
// JPEG JFIF density
// ---------------------------------------------------------------------------

describe('injectJpegDpi', () => {
    it('patches an existing JFIF APP0 from aspect-ratio to DPI density', () => {
        const src = makeJpegWithJfif(0, 1, 1);
        const out = injectJpegDpi(src, 300);
        // Stream layout with SOI at 0-1: version 11-12, units 13, X 14-15, Y 16-17.
        expect(out[11]).toBe(0x01); // version major untouched
        expect(out[12]).toBe(0x01); // version minor untouched
        expect(out[13]).toBe(1);    // units: dpi
        expect((out[14] << 8) | out[15]).toBe(300);
        expect((out[16] << 8) | out[17]).toBe(300);
        // Every other byte identical.
        for (let i = 0; i < out.length; i++) {
            if (i >= 13 && i <= 17) continue;
            expect(out[i]).toBe(src[i]);
        }
    });

    it('inserts a JFIF APP0 after SOI when the stream starts with another segment', () => {
        const dqt = Uint8Array.from([0xff, 0xdb, 0x00, 0x03, 0x01, 0x02, 0x03]);
        const src = new Uint8Array(2 + dqt.length);
        src.set([0xff, 0xd8], 0);
        src.set(dqt, 2);

        const out = injectJpegDpi(src, 150);
        // Inserted JFIF APP0 occupies output bytes 2..19; its internal layout
        // is marker(2) len(2) "JFIF\0"(5) version(2) units(1) X(2) Y(2).
        expect(out[2]).toBe(0xff); expect(out[3]).toBe(0xe0);
        expect(out[6]).toBe(0x4a); // 'J'
        expect(out[13]).toBe(1);   // units: dpi (11 within segment + 2 for SOI)
        expect((out[14] << 8) | out[15]).toBe(150);
        expect((out[16] << 8) | out[17]).toBe(150);
        // Original DQT preserved verbatim after the inserted APP0.
        expect(Buffer.from(out.slice(20)).equals(Buffer.from(dqt))).toBe(true);
    });

    it('rejects non-JPEG streams and out-of-range DPI', () => {
        expect(() => injectJpegDpi(new Uint8Array([0x00, 0x01]), 300)).toThrow(/not a JPEG/);
        expect(() => injectJpegDpi(makeJpegWithJfif(), 70000)).toThrow(/16-bit/);
    });
});

// ---------------------------------------------------------------------------
// Dispatcher + data URLs
// ---------------------------------------------------------------------------

describe('applyDpiMetadata', () => {
    it('routes PNG and JPEG and passes other formats through untouched', () => {
        const png = makePng();
        expect(applyDpiMetadata(png, 'image/png', 300)).not.toBe(png); // rewritten copy
        const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46]);
        expect(applyDpiMetadata(webp, 'image/webp', 300)).toBe(webp); // same reference
    });
});

describe('dataUrlWithDpi', () => {
    it('round-trips a PNG data URL with pHYs present in the decoded bytes', () => {
        const bytes = makePng();
        const b64 = Buffer.from(bytes).toString('base64');
        const out = dataUrlWithDpi(`data:image/png;base64,${b64}`, 'image/png', 300);
        expect(out.startsWith('data:image/png;base64,')).toBe(true);
        const decoded = Buffer.from(out.slice('data:image/png;base64,'.length), 'base64');
        const types = walkChunks(new Uint8Array(decoded)).map(c => c.type);
        expect(types).toContain('pHYs');
    });

    it('passes through formats without a density container unchanged', () => {
        const url = 'data:image/webp;base64,AAAA';
        expect(dataUrlWithDpi(url, 'image/webp', 300)).toBe(url);
    });

    it('rejects a data URL whose mime does not match the format', () => {
        expect(() => dataUrlWithDpi('data:image/jpeg;base64,AAAA', 'image/png', 300)).toThrow(/does not match/);
    });
});
