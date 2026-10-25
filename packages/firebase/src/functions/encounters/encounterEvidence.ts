import type { Part } from '@google/genai';
import { z } from 'zod';
import { parseStorageUri } from '../../lib/storageUri';

export const MAX_ENCOUNTER_ASSETS = 8;
export const MAX_ENCOUNTER_BYTES = 50 * 1024 * 1024;
export const VIDEO_ANALYSIS_SECONDS = 120;

export interface EncounterMediaAsset {
    type: string;
    storagePath?: string;
    downloadUrl?: string;
}

/** Resolve only this project's objects in the capturing user's namespace. */
export function resolveEncounterAsset(asset: EncounterMediaAsset, userId: string, bucket: string): string {
    const reference = asset.storagePath
        ? { bucket, path: asset.storagePath }
        : parseStorageUri(asset.downloadUrl || '');
    if (reference.bucket !== bucket || !reference.path.startsWith(`users/${userId}/`)
        || reference.path.split('/').some(segment => segment === '..' || segment === '.' || !segment)) {
        throw new Error('Captured media is outside this account’s storage.');
    }
    if (asset.downloadUrl) {
        const urlReference = parseStorageUri(asset.downloadUrl);
        if (urlReference.bucket !== bucket || urlReference.path !== reference.path) {
            throw new Error('Captured media references do not match.');
        }
    }
    return reference.path;
}

const MIME_TYPES: Record<string, readonly string[]> = {
    audio: ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm'],
    photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/mpeg'],
    document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    receipt: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
};

/** Metadata must come from Storage, never from the client-provided descriptor. */
export function buildEncounterMediaPart(type: string, fileUri: string, contentType: string, size: number): Part {
    const mimeType = contentType.split(';')[0]!.trim().toLowerCase();
    if (!MIME_TYPES[type]?.includes(mimeType)) throw new Error('Captured media format is not supported for analysis.');
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ENCOUNTER_BYTES) {
        throw new Error('Captured media must be nonempty and at most 50 MB.');
    }
    return {
        fileData: { fileUri, mimeType },
        // Vertex samples representative frames and audio. Bound the clip and
        // report this coverage limit to the user; never imply full-video review.
        ...(type === 'video' ? { videoMetadata: { startOffset: '0s', endOffset: `${VIDEO_ANALYSIS_SECONDS}s`, fps: 1 } } : {}),
    };
}

const fieldNames = ['name', 'phone', 'email', 'organization', 'role', 'notes'] as const;
const evidenceSchema = z.record(z.array(z.string().min(1)).min(1).max(MAX_ENCOUNTER_ASSETS + 1));
const contactSchema = z.object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(80).nullish(),
    email: z.string().trim().max(320).nullish(),
    organization: z.string().trim().max(300).nullish(),
    role: z.enum(['musician', 'promoter', 'venue_staff', 'engineer', 'manager', 'fan', 'industry', 'media', 'other']).nullish(),
    notes: z.string().trim().max(2000).nullish(),
    confidence: z.enum(['high', 'uncertain']),
    evidence: evidenceSchema,
});
const receiptSchema = z.object({
    vendor: z.string().trim().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }),
    amount: z.number().finite().positive().max(1_000_000),
    currency: z.string().trim().length(3),
    category: z.enum(['Travel', 'Equipment', 'Marketing', 'Services', 'Other']),
    tax: z.number().finite().nonnegative().nullish(),
    evidence: evidenceSchema,
});
const analysisSchema = z.object({
    summary: z.string().trim().min(1).max(4000),
    transcript: z.string().max(24000).nullish(),
    contact: contactSchema.nullish(),
    receipt: z.unknown().nullish(),
});

/** Drop fields that lack a citation to evidence actually supplied in this call. */
export function parseEncounterAnalysis(raw: string, sourceIds: readonly string[], receiptSourceIds: readonly string[] = []) {
    const analysis = analysisSchema.parse(JSON.parse(raw));
    const candidateReceipt = receiptSchema.safeParse(analysis.receipt);
    const parsedReceipt = candidateReceipt.success ? candidateReceipt.data : undefined;
    const receipt = parsedReceipt && receiptSourceIds.length > 0 &&
        ['vendor', 'date', 'amount', 'currency'].every(field =>
            parsedReceipt.evidence[field]?.length &&
            parsedReceipt.evidence[field]!.every(id => receiptSourceIds.includes(id))) &&
        parsedReceipt.currency.toUpperCase() === 'USD'
        ? { vendor: parsedReceipt.vendor, date: parsedReceipt.date, amount: parsedReceipt.amount,
            currency: 'USD' as const, category: parsedReceipt.category,
            tax: parsedReceipt.evidence.tax?.every(id => receiptSourceIds.includes(id)) && parsedReceipt.tax !== undefined && parsedReceipt.tax !== null && parsedReceipt.tax <= parsedReceipt.amount ? parsedReceipt.tax : undefined }
        : undefined;
    const candidate = analysis.contact;
    if (!candidate) return { summary: analysis.summary, transcript: analysis.transcript || undefined, contact: undefined, receipt };
    const supported = (field: string) => candidate.evidence[field]?.length
        && candidate.evidence[field]!.every(id => sourceIds.includes(id));
    if (!supported('name')) throw new Error('Contact name has no supplied evidence.');
    const contact: { name: string; phone?: string; email?: string; organization?: string; role?: z.infer<typeof contactSchema>['role']; notes?: string } = { name: candidate.name };
    for (const field of fieldNames) {
        if (field !== 'name' && supported(field) && candidate[field]) Object.assign(contact, { [field]: candidate[field] });
    }
    return {
        summary: analysis.summary,
        transcript: analysis.transcript || undefined,
        receipt,
        contact,
        confidence: candidate.confidence,
        evidence: Object.fromEntries(fieldNames.filter(field => supported(field)).map(field => [field, candidate.evidence[field]])),
    };
}
