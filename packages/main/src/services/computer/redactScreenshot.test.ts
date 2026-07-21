import { describe, it, expect } from 'vitest';
import { redactScreenshotPng } from './redactScreenshot';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function chunk(type: string, data: Buffer | string): Buffer {
    const dataBuf = typeof data === 'string' ? Buffer.from(data, 'ascii') : data;
    const length = Buffer.alloc(4);
    length.writeUInt32BE(dataBuf.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); // CRC is not validated by redactScreenshotPng — dummy bytes are fine
    return Buffer.concat([length, typeBuf, dataBuf, crc]);
}

function buildPng(chunks: Buffer[]): Buffer {
    return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

describe('redactScreenshotPng', () => {
    it('strips a tEXt chunk while preserving IHDR/IDAT/IEND', () => {
        const png = buildPng([
            chunk('IHDR', Buffer.alloc(13)),
            chunk('tEXt', 'Software\x00indii-screenshot-tool'),
            chunk('IDAT', Buffer.from([1, 2, 3, 4])),
            chunk('IEND', Buffer.alloc(0)),
        ]);

        const result = redactScreenshotPng(png);

        expect(result.includes(Buffer.from('tEXt', 'ascii'))).toBe(false);
        expect(result.includes(Buffer.from('IHDR', 'ascii'))).toBe(true);
        expect(result.includes(Buffer.from('IDAT', 'ascii'))).toBe(true);
        expect(result.includes(Buffer.from('IEND', 'ascii'))).toBe(true);
        expect(result.includes(Buffer.from('indii-screenshot-tool', 'ascii'))).toBe(false);
    });

    it('strips zTXt, iTXt, eXIf, and tIME chunks in one pass', () => {
        const png = buildPng([
            chunk('IHDR', Buffer.alloc(13)),
            chunk('zTXt', 'compressed-text-data'),
            chunk('iTXt', 'international-text-data'),
            chunk('eXIf', 'exif-camera-data'),
            chunk('tIME', Buffer.alloc(7)),
            chunk('IDAT', Buffer.from([9, 9, 9])),
            chunk('IEND', Buffer.alloc(0)),
        ]);

        const result = redactScreenshotPng(png);

        for (const strippedType of ['zTXt', 'iTXt', 'eXIf', 'tIME']) {
            expect(result.includes(Buffer.from(strippedType, 'ascii'))).toBe(false);
        }
        expect(result.includes(Buffer.from('IDAT', 'ascii'))).toBe(true);
    });

    it('preserves non-metadata ancillary chunks (pHYs, gAMA)', () => {
        const png = buildPng([
            chunk('IHDR', Buffer.alloc(13)),
            chunk('pHYs', Buffer.alloc(9)),
            chunk('gAMA', Buffer.alloc(4)),
            chunk('IDAT', Buffer.from([5])),
            chunk('IEND', Buffer.alloc(0)),
        ]);

        const result = redactScreenshotPng(png);

        expect(result.includes(Buffer.from('pHYs', 'ascii'))).toBe(true);
        expect(result.includes(Buffer.from('gAMA', 'ascii'))).toBe(true);
    });

    it('produces a smaller buffer when metadata was actually present', () => {
        const withMetadata = buildPng([
            chunk('IHDR', Buffer.alloc(13)),
            chunk('tEXt', 'a fairly long piece of metadata text that takes real space'),
            chunk('IDAT', Buffer.from([1])),
            chunk('IEND', Buffer.alloc(0)),
        ]);
        const result = redactScreenshotPng(withMetadata);
        expect(result.length).toBeLessThan(withMetadata.length);
    });

    it('is a safe no-op on a PNG with no metadata chunks', () => {
        const clean = buildPng([
            chunk('IHDR', Buffer.alloc(13)),
            chunk('IDAT', Buffer.from([7, 7])),
            chunk('IEND', Buffer.alloc(0)),
        ]);
        const result = redactScreenshotPng(clean);
        expect(result.equals(clean)).toBe(true);
    });

    it('does not throw and returns input unchanged for a buffer shorter than the PNG signature', () => {
        const tiny = Buffer.from([1, 2, 3]);
        expect(() => redactScreenshotPng(tiny)).not.toThrow();
        expect(redactScreenshotPng(tiny)).toEqual(tiny);
    });

    it('handles a truncated/malformed chunk by keeping the remainder verbatim instead of throwing', () => {
        const truncated = Buffer.concat([
            PNG_SIGNATURE,
            chunk('IHDR', Buffer.alloc(13)),
            // A length field claiming more data than actually follows.
            (() => {
                const length = Buffer.alloc(4);
                length.writeUInt32BE(9999, 0);
                return Buffer.concat([length, Buffer.from('tEXt', 'ascii'), Buffer.from('short')]);
            })(),
        ]);
        expect(() => redactScreenshotPng(truncated)).not.toThrow();
    });
});
