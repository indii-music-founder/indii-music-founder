import sharp from 'sharp';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { planPrintOutput } from '@indii/shared';

/** Flattened, color-managed CMYK PDF. Not a claim of PDF/X certification. */
export async function makePressPdf(source: Buffer, presetId: string, dpi?: number) {
    const input = await sharp(source, { limitInputPixels: 80_000_000 }).metadata();
    const plan = planPrintOutput({ srcWidth: input.width || 0, srcHeight: input.height || 0, presetId, dpi });
    if (input.width !== plan.required.width || input.height !== plan.required.height) {
        throw new Error('Press artwork must have the exact planned pixel dimensions.');
    }
    const jpeg = await sharp(source, { limitInputPixels: 80_000_000 })
        .flatten({ background: '#ffffff' })
        .withMetadata({ density: plan.dpi })
        .withIccProfile('cmyk')
        .jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toBuffer();
    const converted = await sharp(jpeg).metadata();
    if (converted.space !== 'cmyk' || !converted.icc) throw new Error('CMYK color conversion did not produce an embedded profile.');
    const pdf = await PDFDocument.create();
    const width = plan.exportMeta.widthIn * 72;
    const height = plan.exportMeta.heightIn * 72;
    const bleed = plan.bleedIn * 72;
    const page = pdf.addPage([width, height]);
    page.setBleedBox(0, 0, width, height);
    page.setTrimBox(bleed, bleed, plan.trim.widthIn * 72, plan.trim.heightIn * 72);
    const image = await pdf.embedJpg(jpeg);
    await image.embed();
    // Use the actual ICC profile for the image, not just an uncalibrated DeviceCMYK tag.
    const profile = pdf.context.register(pdf.context.flateStream(converted.icc, { N: 4 }));
    const imageDict = (pdf.context.lookup(image.ref) as import('pdf-lib').PDFRawStream).dict;
    imageDict.set(PDFName.of('ColorSpace'), pdf.context.obj([PDFName.of('ICCBased'), profile]));
    pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([{
        Type: 'OutputIntent', S: 'GTS_PDFX',
        OutputConditionIdentifier: PDFString.of('Generic CMYK - confirm with printer'),
        Info: PDFString.of('Generic CMYK profile bundled by sharp/libvips; request printer-specific conversion when required.'),
        DestOutputProfile: profile,
    }]));
    page.drawImage(image, { x: 0, y: 0, width, height });
    pdf.setTitle(`${presetId} print artwork`);
    pdf.setSubject('CMYK raster artwork with trim and bleed boxes. Printer proof and exact packaging template required; not PDF/X certified.');
    return { bytes: Buffer.from(await pdf.save()), plan };
}
