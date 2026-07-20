import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { PDFDocument, rgb } from 'pdf-lib';

import { failedOperationResult, operationResult, optionalIdempotencyKey, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

const MAX_COLLABORATORS = 20;
const MAX_NAME_LENGTH = 200;
const SUM_TOLERANCE = 0.01;

async function generateSplitSheetPDF(
    trackId: string,
    collaborators: SplitCollaborator[],
    sha256: string,
    createdAt: Date
): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]); // Letter size
    const { height } = page.getSize();
    let y = height - 40;
    const fontSize = 10;
    const lineHeight = 14;

    // Header
    page.drawText('INDII SPLIT SHEET', {
        x: 40,
        y,
        size: 16,
        color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight * 2;

    // Draft watermark
    page.drawText('DRAFT — UNSIGNED', {
        x: 40,
        y,
        size: 10,
        color: rgb(0.8, 0.2, 0.2),
    });
    y -= lineHeight * 1.5;

    // Track and metadata
    page.drawText(`Track: ${trackId}`, { x: 40, y, size: fontSize, color: rgb(0, 0, 0) });
    y -= lineHeight;
    page.drawText(`Generated: ${createdAt.toISOString().split('T')[0]}`, { x: 40, y, size: fontSize, color: rgb(0, 0, 0) });
    y -= lineHeight;
    page.drawText(`SHA256: ${sha256.slice(0, 32)}...`, { x: 40, y, size: fontSize, color: rgb(0.4, 0.4, 0.4) });
    y -= lineHeight * 2;

    // Collaborators header
    page.drawText('COLLABORATORS', { x: 40, y, size: 11, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;

    // Draw table headers
    page.drawText('Name', { x: 40, y, size: fontSize, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Share', { x: 400, y, size: fontSize, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;

    // Draw collaborators (sorted by name for determinism)
    const sorted = [...collaborators].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const collab of sorted) {
        if (y < 60) {
            // Add new page if needed
            page.drawText('(continued on next page)', { x: 40, y, size: 8, color: rgb(0.6, 0.6, 0.6) });
            break;
        }
        page.drawText(collab.name.slice(0, 50), { x: 40, y, size: fontSize, color: rgb(0, 0, 0) });
        page.drawText(`${collab.percentage.toFixed(4)}%`, { x: 400, y, size: fontSize, color: rgb(0, 0, 0) });
        y -= lineHeight;
    }

    y -= lineHeight;
    page.drawText('This is a DRAFT document and is not a legally binding agreement.', {
        x: 40,
        y,
        size: 8,
        color: rgb(0.5, 0.5, 0.5),
    });

    return doc.save();
}

interface SplitCollaborator {
    name: string;
    percentage: number;
}

function parseCollaborators(raw: unknown): SplitCollaborator[] {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_COLLABORATORS) {
        throw new TypeError(`collaborators must be an array of 1-${MAX_COLLABORATORS} entries.`);
    }
    const collaborators = raw.map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new TypeError(`collaborators[${index}] must be an object with name and percentage.`);
        }
        const { name, percentage } = entry as Record<string, unknown>;
        if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
            throw new TypeError(`collaborators[${index}].name must be a non-empty string no longer than ${MAX_NAME_LENGTH} characters.`);
        }
        if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage <= 0) {
            throw new TypeError(`collaborators[${index}].percentage must be a finite number greater than 0.`);
        }
        return { name: name.trim(), percentage };
    });
    const sum = collaborators.reduce((total, c) => total + c.percentage, 0);
    if (Math.abs(sum - 100) > SUM_TOLERANCE) {
        throw new TypeError(`collaborator percentages must sum to 100 (got ${sum}).`);
    }
    return collaborators;
}

/** Deterministic canonical text rendering — collaborators sorted by name. */
function canonicalSplitSheetText(uid: string, trackId: string, collaborators: SplitCollaborator[]): string {
    const sorted = [...collaborators].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const lines = [
        'INDII SPLIT SHEET v1',
        `track: ${trackId}`,
        `initiator: ${uid}`,
        ...sorted.map((c) => `collaborator: ${c.name} | ${c.percentage.toFixed(4)}%`),
    ];
    return lines.join('\n') + '\n';
}

export const registerSplitSheet: IndiiMcpTool = {
    name: 'register_split_sheet',
    description: 'Records a royalty split sheet for the authenticated caller: validates percentages, persists a whitelisted Firestore record, and stores a hashed canonical text artifact. Does NOT collect collaborator signatures or render a PDF contract.',
    inputSchema: {
        type: 'object',
        properties: {
            trackId: { type: 'string', description: 'Track identifier the splits apply to.' },
            releaseId: { type: 'string', description: 'Optional release id; when supplied, ownership by the caller is verified.' },
            collaborators: {
                type: 'array',
                description: '1-20 entries; percentages must sum to 100.',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        percentage: { type: 'number' },
                    },
                    required: ['name', 'percentage'],
                },
            },
            idempotencyKey: { type: 'string', description: 'Optional 8-128 char key for deterministic replay-safe registration.' },
        },
        required: ['trackId', 'collaborators'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let trackId = 'unknown';
        try {
            trackId = requireString(args, 'trackId', 200);
            const collaborators = parseCollaborators(args.collaborators);
            const idempotencyKey = optionalIdempotencyKey(args);

            const firestore = admin.firestore();
            if (args.releaseId !== undefined) {
                const releaseId = requireString(args, 'releaseId', 200);
                await verifyReleaseOwnership(firestore as unknown as OwnershipFirestore, actorUid, releaseId);
            }

            const docId = idempotencyKey
                ? `split_${createHash('sha256').update(`${actorUid}\0register_split_sheet\0${idempotencyKey}`, 'utf8').digest('hex').slice(0, 48)}`
                : firestore.collection('split_sheets').doc().id;

            const canonicalText = canonicalSplitSheetText(actorUid, trackId, collaborators);
            const sha256 = createHash('sha256').update(canonicalText, 'utf8').digest('hex');
            const textStoragePath = `users/${actorUid}/split_sheets/${docId}.txt`;
            const pdfStoragePath = `users/${actorUid}/split_sheets/${docId}.pdf`;
            const createdAt = new Date();

            // Generate and save canonical text
            await admin.storage().bucket().file(textStoragePath).save(canonicalText, {
                contentType: 'text/plain; charset=utf-8',
                resumable: false,
            });

            // Generate and save PDF
            const pdfBytes = await generateSplitSheetPDF(trackId, collaborators, sha256, createdAt);
            await admin.storage().bucket().file(pdfStoragePath).save(Buffer.from(pdfBytes), {
                contentType: 'application/pdf',
                resumable: false,
            });

            // Whitelisted fields only — never persist raw args.
            await firestore.collection('split_sheets').doc(docId).set({
                trackId,
                collaborators: collaborators.map((c) => ({ name: c.name, percentage: c.percentage })),
                initiatorUid: actorUid,
                status: 'recorded_unsigned',
                sha256,
                textStoragePath,
                pdfStoragePath,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return toolResponse(operationResult({
                tool: 'register_split_sheet',
                actorUid,
                status: 'succeeded',
                resourceType: 'split_sheet',
                resourceId: docId,
                idempotencyKey,
                evidence: [
                    { type: 'storage_object', reference: textStoragePath, sha256 },
                    { type: 'storage_object', reference: pdfStoragePath },
                ],
                warnings: [
                    'Split sheet recorded with PDF artifact, but NOT countersigned by collaborators.',
                    'PDF is a DRAFT for reference; this record is not a legally binding agreement.',
                ],
                data: {
                    trackId,
                    collaborators: collaborators.map((c) => ({ name: c.name, percentage: c.percentage })),
                    status: 'recorded_unsigned',
                    sha256,
                    textStoragePath,
                    pdfStoragePath,
                },
            }));
        } catch (error) {
            const isInvalid = error instanceof TypeError;
            return toolResponse(failedOperationResult({
                tool: 'register_split_sheet',
                actorUid,
                resourceType: 'split_sheet',
                resourceId: trackId,
                code: isInvalid ? 'INVALID_ARGUMENT' : 'SPLIT_SHEET_REGISTRATION_FAILED',
                message: error instanceof Error ? error.message : 'Split sheet registration failed.',
                retryable: false,
            }));
        }
    },
};
