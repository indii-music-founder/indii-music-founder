import { describe, expect, it } from 'vitest';
import { inspectImageMetadata, physicalImageSize } from './inspectImageMetadata';
import { injectPngDpi } from '@/services/print/dpiMetadata';

// Byte-format checks only; these are not persisted assets or customer journeys.
const png = () => {
    const bytes = new Uint8Array(33);
    bytes.set([137,80,78,71,13,10,26,10]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13); bytes.set([73,72,68,82], 12);
    view.setUint32(16, 3000); view.setUint32(20, 3000);
    return bytes;
};
describe('Original image metadata', () => {
    it('reads physical density from the actual print encoding', () => {
        const details = inspectImageMetadata(injectPngDpi(png(), 300));
        expect(details.width).toBe(3000); expect(details.height).toBe(3000);
        expect(details.dpiX).toBeCloseTo(300, 2);
        expect(physicalImageSize(details)).toBe('10 × 10 in (25.4 × 25.4 cm)');
    });
    it('does not invent DPI for an ordinary PNG or unitless density', () => {
        expect(inspectImageMetadata(png()).dpiX).toBeUndefined();
        const bytes = injectPngDpi(png(), 300); bytes[49] = 0;
        expect(inspectImageMetadata(bytes).dpiX).toBeUndefined();
        expect(physicalImageSize({ width: 3000, height: 3000 })).toBeUndefined();
    });
    it('reads JPEG JFIF inch and centimeter density', () => {
        const bytes = new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,2,1,1,44,1,44,0,0,255,217]);
        expect(inspectImageMetadata(bytes)).toMatchObject({ format: 'JPEG', dpiX: 300, dpiY: 300 });
        bytes[13] = 2;
        expect(inspectImageMetadata(bytes).dpiX).toBe(762);
    });
    it('reads EXIF rational density in both TIFF byte orders', () => {
        for (const little of [true, false]) {
            const bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
            bytes.set([255,216,255,225,0,72,69,120,105,102,0,0]);
            bytes.set(little ? [73,73] : [77,77], 12);
            view.setUint16(14,42,little); view.setUint32(16,8,little); view.setUint16(20,3,little);
            for (const [index,tag,value] of [[0,282,50],[1,283,58],[2,296,2]]) {
                const entry = 22 + index! * 12;
                view.setUint16(entry,tag!,little); view.setUint16(entry+2,index === 2 ? 3 : 5,little);
                view.setUint32(entry+4,1,little);
                if (index === 2) view.setUint16(entry+8,value!,little); else view.setUint32(entry+8,value!,little);
            }
            view.setUint32(62,300,little); view.setUint32(66,1,little);
            view.setUint32(70,600,little); view.setUint32(74,1,little);
            // APP1 includes both complete rational values.
            view.setUint16(4,76);
            expect(inspectImageMetadata(bytes)).toMatchObject({dpiX:300,dpiY:600});
        }
    });
    it('keeps asymmetric density when calculating physical size', () => {
        expect(physicalImageSize({ width: 3000, height: 6000, dpiX: 300, dpiY: 600 })).toBe('10 × 10 in (25.4 × 25.4 cm)');
    });
    it('handles unknown and truncated byte streams without throwing', () => {
        for (const bytes of [new Uint8Array(), new Uint8Array([255,216,255,225,255,255]), png().subarray(0,20)]) {
            expect(() => inspectImageMetadata(bytes)).not.toThrow();
            expect(inspectImageMetadata(bytes).dpiX).toBeUndefined();
        }
    });
});
