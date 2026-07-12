/**
 * ISSUE-961: M4A/MP4 are containers, not codecs — they can carry either
 * lossless ALAC or lossy AAC. This walks the ISO-BMFF box tree
 * (moov/trak/mdia/hdlr/minf/stbl/stsd) to read the actual audio sample
 * entry's codec fourcc instead of trusting the file extension/MIME type.
 */

export type M4ACodecProbeResult =
    | { status: 'lossless'; codec: 'alac' }
    | { status: 'lossy'; codec: string }
    | { status: 'undetermined' };

interface Box {
    start: number;
    end: number;
}

function readFourCC(view: DataView, offset: number): string {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}

function findBoxes(view: DataView, start: number, end: number, fourcc: string): Box[] {
    const results: Box[] = [];
    let offset = start;

    while (offset + 8 <= end) {
        const boxSize = view.getUint32(offset);
        const boxType = readFourCC(view, offset + 4);

        let size = boxSize;
        let headerSize = 8;

        if (boxSize === 1) {
            // 64-bit extended size follows the 4-byte type.
            if (offset + 16 > end) break;
            const hi = view.getUint32(offset + 8);
            const lo = view.getUint32(offset + 12);
            size = hi * 4294967296 + lo;
            headerSize = 16;
        } else if (boxSize === 0) {
            // Box extends to the end of the containing range.
            size = end - offset;
        }

        if (size < headerSize || offset + size > end) break; // corrupt/truncated box

        if (boxType === fourcc) {
            results.push({ start: offset + headerSize, end: offset + size });
        }

        offset += size;
    }

    return results;
}

/**
 * Reads the codec fourcc from the first audio (`soun`) track's sample
 * description. Returns 'undetermined' for anything that can't be parsed —
 * corrupt/truncated files, or containers that aren't actually ISO-BMFF
 * despite an `.m4a`/`.mp4` extension. Callers must treat 'undetermined' as
 * a failure, never as an implicit pass.
 */
export async function detectM4ACodec(file: File): Promise<M4ACodecProbeResult> {
    let buffer: ArrayBuffer;
    try {
        buffer = await file.arrayBuffer();
    } catch {
        return { status: 'undetermined' };
    }

    if (buffer.byteLength < 8) return { status: 'undetermined' };

    const view = new DataView(buffer);
    const len = buffer.byteLength;

    const moovBoxes = findBoxes(view, 0, len, 'moov');
    if (moovBoxes.length === 0) return { status: 'undetermined' };
    const moov = moovBoxes[0]!;

    const traks = findBoxes(view, moov.start, moov.end, 'trak');
    for (const trak of traks) {
        const mdiaBoxes = findBoxes(view, trak.start, trak.end, 'mdia');
        if (mdiaBoxes.length === 0) continue;
        const mdia = mdiaBoxes[0]!;

        const hdlrBoxes = findBoxes(view, mdia.start, mdia.end, 'hdlr');
        if (hdlrBoxes.length === 0) continue;
        const hdlr = hdlrBoxes[0]!;
        // hdlr body: version(1) + flags(3) + pre_defined(4) + handler_type(4)
        if (hdlr.start + 12 > hdlr.end) continue;
        const handlerType = readFourCC(view, hdlr.start + 8);
        if (handlerType !== 'soun') continue; // not the audio track

        const minfBoxes = findBoxes(view, mdia.start, mdia.end, 'minf');
        if (minfBoxes.length === 0) continue;
        const stblBoxes = findBoxes(view, minfBoxes[0]!.start, minfBoxes[0]!.end, 'stbl');
        if (stblBoxes.length === 0) continue;
        const stsdBoxes = findBoxes(view, stblBoxes[0]!.start, stblBoxes[0]!.end, 'stsd');
        if (stsdBoxes.length === 0) continue;
        const stsd = stsdBoxes[0]!;

        // stsd body: version(1) + flags(3) + entry_count(4), then the first
        // sample entry box whose type IS the codec fourcc (e.g. 'alac', 'mp4a').
        const entryOffset = stsd.start + 8;
        if (entryOffset + 8 > stsd.end) continue;
        const codec = readFourCC(view, entryOffset + 4);

        if (codec === 'alac') return { status: 'lossless', codec: 'alac' };
        return { status: 'lossy', codec };
    }

    return { status: 'undetermined' };
}
