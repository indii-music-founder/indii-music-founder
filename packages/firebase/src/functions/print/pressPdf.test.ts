import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFArray, PDFRawStream } from 'pdf-lib';
import { makePressPdf } from './pressPdf';

// Pure codec/geometry checks, not evidence of a signed-in production export.
describe('press PDF encoding', () => {
    it('embeds actual CMYK pixels and ICC profile with the cassette trim and bleed boxes', async () => {
        const source = await sharp({ create: { width: 1313, height: 1275, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 0.5 } } }).png().toBuffer();
        const result = await makePressPdf(source, 'cassette_jcard');
        const pdf = await PDFDocument.load(result.bytes);
        const page = pdf.getPage(0);
        expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 315, height: 306 });
        expect(page.getBleedBox()).toEqual(page.getMediaBox());
        expect(page.getTrimBox()).toEqual({ x: 9, y: 9, width: 297, height: 288 });
        const image = pdf.context.enumerateIndirectObjects().map(([, object]) => object).find(object => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image') as PDFRawStream;
        expect(image).toBeDefined();
        const encoded = await sharp(image.contents).metadata();
        expect(encoded.space).toBe('cmyk');
        expect(encoded.channels).toBe(4);
        expect(encoded.icc?.length).toBeGreaterThan(0);
        expect(encoded.density).toBe(300);
        const colorSpace = image.dict.get(PDFName.of('ColorSpace')) as PDFArray;
        expect(colorSpace.get(0).toString()).toBe('/ICCBased');
        expect(pdf.catalog.get(PDFName.of('OutputIntents'))).toBeDefined();
    });
    it('rejects a press file that has silently lost resolution', async () => {
        const source = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: 'white' } }).png().toBuffer();
        await expect(makePressPdf(source, 'vinyl_sleeve')).rejects.toThrow('exact planned pixel dimensions');
    });
});
