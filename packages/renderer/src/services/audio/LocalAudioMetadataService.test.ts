import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalAudioMetadataService } from './LocalAudioMetadataService';

const encoder = new TextEncoder();
const ascii = (value: string) => encoder.encode(value);
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};
const concat = (...chunks: Uint8Array[]) => {
    const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
};

function le32(value: number): Uint8Array {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
}

function riffChunk(id: string, body: Uint8Array): Uint8Array {
    return concat(ascii(id), le32(body.length), body, body.length % 2 ? new Uint8Array([0]) : new Uint8Array());
}

function waveInfoFixture(): Uint8Array {
    const info = concat(
        ascii('INFO'),
        riffChunk('INAM', ascii('Detected title\0')),
        riffChunk('IART', ascii('Detected artist\0')),
        riffChunk('ISRC', ascii('USABC2600001\0')),
    );
    const chunks = concat(riffChunk('JUNK', new Uint8Array()), riffChunk('data', new Uint8Array([1, 2, 3, 4])), riffChunk('LIST', info));
    return concat(ascii('RIFF'), le32(4 + chunks.length), ascii('WAVE'), chunks);
}

function vorbisComment(value: string): Uint8Array {
    const encoded = ascii(value);
    return concat(le32(encoded.length), encoded);
}

function flacFixture(): Uint8Array {
    const vendor = ascii('test');
    const comments = ['TITLE=Detected FLAC title', 'ARTIST=Detected FLAC artist', 'ISRC=USABC2600002'];
    const block = concat(le32(vendor.length), vendor, le32(comments.length), ...comments.map(vorbisComment));
    const header = new Uint8Array([0x84, (block.length >> 16) & 0xff, (block.length >> 8) & 0xff, block.length & 0xff]);
    return concat(ascii('fLaC'), header, block);
}

describe('LocalAudioMetadataService', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads only embedded WAV tags and leaves every value detected and unconfirmed', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const file = new File([toArrayBuffer(waveInfoFixture())], 'master.wav', { type: 'audio/wav' });
        const report = await new LocalAudioMetadataService().inspect(file);

        expect(report.filename).toBe('master.wav');
        expect(report.fields).toEqual([
            { field: 'title', value: 'Detected title' },
            { field: 'artist', value: 'Detected artist' },
            { field: 'isrc', value: 'USABC2600001' },
        ]);
        expect(report.provenance.state).toBe('DETECTED');
        expect(report.provenance.note).toMatch(/unconfirmed/i);
        expect(report.mode).toBe('LOCAL_ONLY');
        expect(report.networkCalls).toBe(0);
        expect(report.persisted).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('extracts bounded FLAC Vorbis comments from a local blob', async () => {
        const report = await new LocalAudioMetadataService().inspect(new Blob([toArrayBuffer(flacFixture())]));
        expect(report.fields).toEqual([
            { field: 'title', value: 'Detected FLAC title' },
            { field: 'artist', value: 'Detected FLAC artist' },
            { field: 'isrc', value: 'USABC2600002' },
        ]);
        expect(report.provenance.state).toBe('DETECTED');
    });

    it('does not guess metadata for unsupported or untagged files', async () => {
        const report = await new LocalAudioMetadataService().inspect(new File(['not audio'], 'unknown.bin'));
        expect(report.fields).toEqual([]);
        expect(report.provenance.state).toBe('DETECTED');
    });

    it('does not inspect trailing bytes outside the declared RIFF container', async () => {
        const fixture = waveInfoFixture();
        new DataView(fixture.buffer).setUint32(4, 4, true);
        const report = await new LocalAudioMetadataService().inspect(new Blob([toArrayBuffer(fixture)]));
        expect(report.fields).toEqual([]);
    });

    it('rejects paths and handles malformed chunk lengths without reading outside the file', async () => {
        const service = new LocalAudioMetadataService();
        await expect(service.inspect('/private/master.wav' as unknown as Blob)).rejects.toThrow(/in-memory/i);

        const malformed = concat(ascii('RIFF'), le32(1000), ascii('WAVE'), ascii('LIST'), le32(2048));
        const report = await service.inspect(new Blob([toArrayBuffer(malformed)]));
        expect(report.fields).toEqual([]);
    });
});
