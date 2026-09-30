import * as admin from 'firebase-admin';
import JSZip from 'jszip';
import { randomUUID } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import sharp from 'sharp';
import { getPrintPreset, planPrintOutput } from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { assertUserOwnsStoragePath, parseStorageUri } from '../../lib/storageUri';
import { enforceRateLimit } from '../../lib/rateLimit';
import { makePressPdf } from './pressPdf';

const schema = z.object({ assets: z.array(z.object({ uri: z.string().min(1), presetId: z.string(), dpi: z.number().int().positive() })).min(1).max(10) });
export const preparePrintHandoff = onCall(
    { timeoutSeconds: 120, memory: '2GiB', enforceAppCheck: false },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to prepare press artwork.');
        const parsed = schema.safeParse(request.data);
        if (!parsed.success) throw new HttpsError('invalid-argument', 'Valid artwork and print targets are required.');
        await enforceRateLimit(request.auth.uid, 'preparePrintHandoff', { maxRequests: 12, windowMs: 60_000 });
        if (new Set(parsed.data.assets.map(asset => asset.presetId)).size !== parsed.data.assets.length) throw new HttpsError('invalid-argument', 'Choose each print target once.');
        const zip = new JSZip();
        const bucket = admin.storage().bucket().name;
        let totalBytes = 0;
        for (const asset of parsed.data.assets) {
            const preset = getPrintPreset(asset.presetId);
            if (!preset) throw new HttpsError('invalid-argument', 'Unknown print target.');
            const reference = parseStorageUri(asset.uri);
            if (reference.bucket !== bucket) throw new HttpsError('permission-denied', 'Artwork must be in this project.');
            assertUserOwnsStoragePath(reference.path, request.auth.uid);
            const file = admin.storage().bucket(bucket).file(reference.path);
            const [metadata] = await file.getMetadata();
            totalBytes += Number(metadata.size);
            if (!metadata.contentType?.startsWith('image/') || !Number.isFinite(totalBytes) || totalBytes > 150 * 1024 * 1024) throw new HttpsError('invalid-argument', 'Print artwork must total less than 150 MB.');
            const [source] = await file.download();
            const dimensions = await sharp(source, { limitInputPixels: 80_000_000 }).metadata();
            const plan = planPrintOutput({ srcWidth: dimensions.width || 0, srcHeight: dimensions.height || 0, presetId: asset.presetId, dpi: asset.dpi });
            if (dimensions.width !== plan.required.width || dimensions.height !== plan.required.height) throw new HttpsError('failed-precondition', 'Artwork must match the planned dimensions.');
            const folder = zip.folder(asset.presetId)!;
            folder.file(`${plan.required.width}x${plan.required.height}.png`, source);
            const paper = preset.category === 'physical' && preset.id !== 'dtf_12x16';
            if (paper) {
                const result = await makePressPdf(source, asset.presetId, asset.dpi).catch((error: Error) => {
                    throw new HttpsError('failed-precondition', error.message);
                });
                folder.file('CMYK.pdf', result.bytes);
            }
            folder.file('print-settings.json', JSON.stringify({
                ...plan.exportMeta, rgbArtwork: 'sRGB PNG',
                pressArtwork: paper ? 'ICC-managed CMYK PDF' : undefined,
                profile: paper ? 'Generic CMYK (confirm with printer)' : undefined,
                pdfStandard: paper ? 'PDF with TrimBox and BleedBox; not PDF/X certified' : undefined,
                transparency: 'PNG preserves alpha; press PDF is flattened on white',
                fit: 'Centered crop',
                foldsFromLeftTrimIn: plan.foldsIn,
                printerInstructions: plan.handoff ?? 'Confirm bleed, safe area, color profile and proof with your printer.',
            }, null, 2));
        }
        const bundle = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
        const outputPath = `users/${request.auth.uid}/assets/print-${randomUUID()}.zip`;
        const token = randomUUID();
        await admin.storage().bucket(bucket).file(outputPath).save(bundle, {
            resumable: false, contentType: 'application/zip', metadata: { metadata: { firebaseStorageDownloadTokens: token } },
        });
        return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(outputPath)}?alt=media&token=${token}`, bytes: bundle.length };
    },
);
