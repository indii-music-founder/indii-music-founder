import { describe, it, expect } from 'vitest';
import { detectM4ACodec } from './M4ACodecProbe';

function box(fourcc: string, payload: Uint8Array): Uint8Array {
    const size = 8 + payload.length;
    const buf = new Uint8Array(size);
    const view = new DataView(buf.buffer);
    view.setUint32(0, size);
    for (let i = 0; i < 4; i++) buf[4 + i] = fourcc.charCodeAt(i);
    buf.set(payload, 8);
    return buf;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        result.set(a, offset);
        offset += a.length;
    }
    return result;
}

function hdlrPayload(handlerType: string): Uint8Array {
    const payload = new Uint8Array(12); // version/flags(4) + pre_defined(4) + handler_type(4)
    for (let i = 0; i < 4; i++) payload[8 + i] = handlerType.charCodeAt(i);
    return payload;
}

function stsdPayload(codecFourCC: string): Uint8Array {
    const versionFlags = new Uint8Array(4);
    const entryCount = new Uint8Array(4);
    entryCount[3] = 1; // entry_count = 1
    const sampleEntry = box(codecFourCC, new Uint8Array(8));
    return concat(versionFlags, entryCount, sampleEntry);
}

function buildM4A(codecFourCC: string, handlerType: string = 'soun'): Uint8Array {
    const stsdBox = box('stsd', stsdPayload(codecFourCC));
    const stblBox = box('stbl', stsdBox);
    const minfBox = box('minf', stblBox);
    const hdlrBox = box('hdlr', hdlrPayload(handlerType));
    const mdiaBox = box('mdia', concat(hdlrBox, minfBox));
    const trakBox = box('trak', mdiaBox);
    const moovBox = box('moov', trakBox);
    const ftypBox = box('ftyp', new Uint8Array([0x4d, 0x34, 0x41, 0x20])); // 'M4A '
    return concat(ftypBox, moovBox);
}

function toFile(bytes: Uint8Array, name = 'test.m4a'): File {
    return new File([bytes.slice().buffer], name, { type: 'audio/mp4' });
}

describe('detectM4ACodec (ISSUE-961)', () => {
    it('identifies ALAC-in-M4A as lossless', async () => {
        const result = await detectM4ACodec(toFile(buildM4A('alac')));
        expect(result).toEqual({ status: 'lossless', codec: 'alac' });
    });

    it('identifies AAC-in-M4A (mp4a) as lossy', async () => {
        const result = await detectM4ACodec(toFile(buildM4A('mp4a')));
        expect(result).toEqual({ status: 'lossy', codec: 'mp4a' });
    });

    it('treats a non-ISO-BMFF file (renamed) as undetermined, never as an implicit pass', async () => {
        const bytes = new TextEncoder().encode('this is not an mp4 container at all, just text bytes padded out');
        const result = await detectM4ACodec(toFile(bytes));
        expect(result.status).toBe('undetermined');
    });

    it('treats a truncated/corrupt moov box as undetermined', async () => {
        const good = buildM4A('alac');
        // Cut the buffer off mid-moov so the declared box size overruns the
        // actual byte length.
        const truncated = good.slice(0, good.length - 20);
        const result = await detectM4ACodec(toFile(truncated));
        expect(result.status).toBe('undetermined');
    });

    it('treats an M4A with only a video track (no soun handler) as undetermined', async () => {
        const result = await detectM4ACodec(toFile(buildM4A('avc1', 'vide')));
        expect(result.status).toBe('undetermined');
    });
});
