import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';

import { failedOperationResult, operationResult, optionalIdempotencyKey, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

const MAX_COLLABORATORS = 20;
const MAX_NAME_LENGTH = 200;
const SUM_TOLERANCE = 0.01;

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
            const storagePath = `users/${actorUid}/split_sheets/${docId}.txt`;

            await admin.storage().bucket().file(storagePath).save(canonicalText, {
                contentType: 'text/plain; charset=utf-8',
                resumable: false,
            });

            // Whitelisted fields only — never persist raw args.
            await firestore.collection('split_sheets').doc(docId).set({
                trackId,
                collaborators: collaborators.map((c) => ({ name: c.name, percentage: c.percentage })),
                initiatorUid: actorUid,
                status: 'recorded_unsigned',
                sha256,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return toolResponse(operationResult({
                tool: 'register_split_sheet',
                actorUid,
                status: 'succeeded',
                resourceType: 'split_sheet',
                resourceId: docId,
                idempotencyKey,
                evidence: [{ type: 'storage_object', reference: storagePath, sha256 }],
                warnings: [
                    'Split sheet recorded and hashed, but NOT countersigned by collaborators.',
                    'No PDF contract has been rendered yet; this record is not a signed agreement.',
                ],
                data: {
                    trackId,
                    collaborators: collaborators.map((c) => ({ name: c.name, percentage: c.percentage })),
                    status: 'recorded_unsigned',
                    sha256,
                    storagePath,
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
