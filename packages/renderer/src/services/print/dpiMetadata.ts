/**
 * dpiMetadata.ts
 *
 * Pure byte-level DPI metadata for print-ready exports (PRD Workstream 6,
 * ISSUE-322). Browser canvas never writes physical density, so the encoded
 * bytes are post-processed:
 *
 *   - PNG: insert a pHYs chunk (pixels-per-metre) after IHDR, replacing any
 *     existing pHYs, with a real IEEE CRC32 over type+data.
 *   - JPEG: patch the JFIF APP0 density fields (units = dots-per-inch); if
 *     the stream has no JFIF APP0, one is inserted directly after SOI
 *     (JFIF requires APP0 first).
 *   - Other formats (e.g. webp): returned unchanged — no density container.
 *
 * HARD RULE: no DOM, no canvas, no I/O — pure functions over Uint8Array.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PPM_PER_DPI = 1 / 0.0254; // inches → metres (PNG pHYs unit spec)

// ---------------------------------------------------------------------------
// CRC32 (IEEE 802.3, reflected, poly 0xEDB88320 — the PNG chunk checksum)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
    const table = new Array<number>(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

interface PngChunk {
    type: string;
    /** Full chunk bytes: length + type + data + CRC. */
    raw: Uint8Array;
}

function isPng(data: Uint8Array): boolean {
    return data.length >= 8 && PNG_SIGNATURE.every((b, i) => data[i] === b);
}

function walkPngChunks(data: Uint8Array): PngChunk[] {
    const chunks: PngChunk[] = [];
    let off = 8;
    while (off + 12 <= data.length) {
        const view = new DataView(data.buffer, data.byteOffset + off, 8);
        const len = view.getUint32(0);
        const type = String.fromCharCode(data[off + 4], data[off + 5], data[off + 6], data[off + 7]);
        const end = off + 12 + len;
        if (end > data.length) throw new Error('dpiMetadata: truncated PNG chunk');
        chunks.push({ type, raw: data.slice(off, end) });
        off = end;
    }
    if (off !== data.length) throw new Error('dpiMetadata: trailing bytes after PNG IEND region');
    return chunks;
}

function buildPngChunk(type: string, payload: Uint8Array): Uint8Array {
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

/**
 * Rewrite a PNG so it carries exactly one pHYs chunk (after IHDR) declaring
 * the given DPI in both axes. Existing pHYs chunks are removed.
 */
export function injectPngDpi(png: Uint8Array, dpi: number): Uint8Array {
    if (!isPng(png)) throw new Error('dpiMetadata: not a PNG stream');
    if (!(dpi > 0)) throw new Error('dpiMetadata: dpi must be positive');

    const ppm = Math.round(dpi * PPM_PER_DPI);
    const chunks = walkPngChunks(png);
    if (chunks.length === 0 || chunks[0].type !== 'IHDR') {
        throw new Error('dpiMetadata: PNG does not start with IHDR');
    }

    const payload = new Uint8Array(9);
    const view = new DataView(payload.buffer);
    view.setUint32(0, ppm);
    view.setUint32(4, ppm);
    payload[8] = 1; // unit: metre
    const phys = buildPngChunk('pHYs', payload);

    const kept: PngChunk[] = [];
    let inserted = false;
    for (const chunk of chunks) {
        if (chunk.type === 'pHYs') continue; // strip existing density
        kept.push(chunk);
        if (!inserted) {
            kept.push({ type: 'pHYs', raw: phys });
            inserted = true;
        }
    }

    const total = 8 + kept.reduce((sum, c) => sum + c.raw.length, 0);
    const out = new Uint8Array(total);
    out.set(PNG_SIGNATURE, 0);
    let off = 8;
    for (const c of kept) {
        out.set(c.raw, off);
        off += c.raw.length;
    }
    return out;
}

// ---------------------------------------------------------------------------
// JPEG (JFIF APP0)
// ---------------------------------------------------------------------------

/**
 * Rewrite a JPEG so its JFIF APP0 declares the given DPI. Streams without a
 * JFIF APP0 get one inserted immediately after SOI (JFIF requires APP0 to be
 * the first segment). Non-JFIF APP0 segments (e.g. Exif) are preserved after
 * the inserted JFIF header.
 */
export function injectJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
    if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
        throw new Error('dpiMetadata: not a JPEG stream (missing SOI)');
    }
    if (!(dpi > 0)) throw new Error('dpiMetadata: dpi must be positive');
    if (dpi > 0xffff) throw new Error('dpiMetadata: dpi exceeds JFIF 16-bit density field');

    const hasJfifApp0 =
        jpeg[2] === 0xff && jpeg[3] === 0xe0 &&
        jpeg[6] === 0x4a && jpeg[7] === 0x46 && jpeg[8] === 0x49 && jpeg[9] === 0x46 && jpeg[10] === 0x00;

    if (hasJfifApp0) {
        const out = jpeg.slice();
        // Segment layout relative to the stream (SOI occupies bytes 0-1, the
        // APP0 segment starts at 2): marker 2-3, len 4-5, "JFIF\0" 6-10,
        // version 11-12, units 13, X density 14-15, Y density 16-17.
        out[13] = 1; // units: dots per inch
        out[14] = (dpi >> 8) & 0xff;
        out[15] = dpi & 0xff;
        out[16] = (dpi >> 8) & 0xff;
        out[17] = dpi & 0xff;
        return out;
    }

    // Insert a minimal JFIF 1.01 APP0 right after SOI.
    const app0 = new Uint8Array(18);
    app0[0] = 0xff; app0[1] = 0xe0;
    app0[2] = 0x00; app0[3] = 0x10; // segment length: 16
    app0[4] = 0x4a; app0[5] = 0x46; app0[6] = 0x49; app0[7] = 0x46; app0[8] = 0x00; // "JFIF\0"
    app0[9] = 0x01; app0[10] = 0x01; // version 1.01
    app0[11] = 1; // units: dots per inch
    app0[12] = (dpi >> 8) & 0xff; app0[13] = dpi & 0xff;
    app0[14] = (dpi >> 8) & 0xff; app0[15] = dpi & 0xff;
    app0[16] = 0x00; app0[17] = 0x00; // no thumbnail

    const out = new Uint8Array(jpeg.length + app0.length);
    out.set(jpeg.subarray(0, 2), 0);
    out.set(app0, 2);
    out.set(jpeg.subarray(2), 2 + app0.length);
    return out;
}

// ---------------------------------------------------------------------------
// Dispatcher + data-URL helper
// ---------------------------------------------------------------------------

/**
 * Apply DPI metadata to encoded image bytes. Returns the input unchanged for
 * formats without a density container (webp, gif, …).
 */
export function applyDpiMetadata(data: Uint8Array, format: string, dpi: number): Uint8Array {
    if (format === 'image/png') return injectPngDpi(data, dpi);
    if (format === 'image/jpeg') return injectJpegDpi(data, dpi);
    return data;
}

/**
 * Rewrite a canvas data URL so the encoded bytes carry DPI metadata.
 * Non-density formats pass through untouched.
 */
export function dataUrlWithDpi(dataUrl: string, format: string, dpi: number): string {
    if (format !== 'image/png' && format !== 'image/jpeg') return dataUrl;
    const marker = `data:${format};base64,`;
    if (!dataUrl.startsWith(marker)) {
        throw new Error(`dpiMetadata: data URL does not match expected format ${format}`);
    }
    const binary = atob(dataUrl.slice(marker.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const tagged = applyDpiMetadata(bytes, format, dpi);
    let binaryOut = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < tagged.length; i += CHUNK) {
        binaryOut += String.fromCharCode(...tagged.subarray(i, i + CHUNK));
    }
    return marker + btoa(binaryOut);
}
