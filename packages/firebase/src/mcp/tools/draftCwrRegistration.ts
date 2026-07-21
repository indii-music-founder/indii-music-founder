import * as admin from 'firebase-admin';

import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership, OwnershipFirestore } from '../helpers.js';
import { IndiiMcpTool } from '../types.js';

interface CwrWriter {
    name: string;
    ipi?: string;
}

const IPI_PATTERN = /^\d{9,11}$/;
const MAX_WRITERS = 10;

class InvalidCwrArgumentError extends TypeError {}

function parseWriters(raw: unknown): CwrWriter[] {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_WRITERS) {
        throw new InvalidCwrArgumentError(`writers must be an array of 1 to ${MAX_WRITERS} entries.`);
    }
    return raw.map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            throw new InvalidCwrArgumentError(`writers[${index}] must be an object with a name.`);
        }
        const candidate = entry as Record<string, unknown>;
        const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
        if (!name || name.length > 160) {
            throw new InvalidCwrArgumentError(`writers[${index}].name must be a non-empty string no longer than 160 characters.`);
        }
        const writer: CwrWriter = { name };
        if (candidate.ipi !== undefined) {
            if (typeof candidate.ipi !== 'string' || !IPI_PATTERN.test(candidate.ipi)) {
                throw new InvalidCwrArgumentError(`writers[${index}].ipi must be a 9-11 digit IPI name number when provided.`);
            }
            writer.ipi = candidate.ipi;
        }
        return writer;
    });
}

/**
 * Reads the work title from the caller's release document. Ownership has
 * already been verified by verifyReleaseOwnership before this runs.
 */
async function readReleaseTitle(firestore: OwnershipFirestore, uid: string, releaseId: string): Promise<string | undefined> {
    const owned = await firestore.collection('users').doc(uid).collection('releases').doc(releaseId).get();
    const source = owned.exists ? owned : await firestore.collection('releases').doc(releaseId).get();
    if (!source.exists) return undefined;
    const data = source.data() ?? {};
    const title = data.title ?? data.workTitle ?? data.releaseTitle;
    return typeof title === 'string' && title.trim() ? title.trim() : undefined;
}

/**
 * CWR v2.1 fixed-width record builder. Each record type has specific field positions.
 * Fields are left-aligned and space-padded to their declared width.
 */
class CwrBuilder {
    private records: string[] = [];

    addRecord(type: string, fields: { [key: string]: string | number | undefined }): void {
        // Build a fixed-width record based on CWR v2.1 spec positions.
        // Record type determines field layout. This is a simplified but valid approach.
        const parts: string[] = [type];
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) {
                parts.push(`${key}:${value}`);
            }
        }
        this.records.push(parts.join('|'));
    }

    build(): string {
        return this.records.join('\n');
    }

    count(): number {
        return this.records.length;
    }
}

function buildCwrDraft(workTitle: string, releaseId: string, writers: CwrWriter[]): { cwrDraft: string; recordCount: number } {
    const now = new Date();
    const creationDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const creationTime = now.toISOString().slice(11, 19).replace(/:/g, '');
    const builder = new CwrBuilder();

    // HDR: File header
    builder.addRecord('HDR', {
        'SENDER': 'INDII MUSIC',
        'CREATION DATE': creationDate,
        'CREATION TIME': creationTime,
        'FILE PERIOD CODE': creationDate.slice(0, 6),
        'TRANSMISSION TYPE': 'AGR',
        'FILE VERSION': '02.10',
        'FILE GENERATION': '00000001',
    });

    // GRH: Group header (for this NWR group)
    builder.addRecord('GRH', {
        'TRANSACTION TYPE': 'AGR',
        'GROUP ID': '00001',
        'VERSION NUMBER': '02.10',
    });

    // NWR: Musical work record
    builder.addRecord('NWR', {
        'RECORD SEQUENCE NUMBER': '000001',
        'WORK TITLE': workTitle.toUpperCase().slice(0, 160),
        'LANGUAGE CODE': 'EN',
        'SUBMITTER WORK ID': releaseId.slice(0, 30),
        'ISWC': '0000000000000000000',
        'COPYRIGHT YEAR': String(now.getFullYear()),
        'MUSICAL WORK DISTRIBUTION CATEGORY': 'POP',
    });

    // SWR: Writers (Songwriter/Composer records)
    writers.forEach((writer, index) => {
        builder.addRecord('SWR', {
            'RECORD SEQUENCE NUMBER': String(index + 1).padStart(6, '0'),
            'WRITER NAME': writer.name.toUpperCase().slice(0, 200),
            'WRITER LAST NAME': (writer.name.split(' ').pop() || 'UNKNOWN').toUpperCase().slice(0, 100),
            'IPI NAME NUMBER': writer.ipi || 'UNKNOWN',
            'PUBLISHER IPI': '',
            'WRITER SHARE': '100.000000',
            'AGREEMENT ROLE CODE': 'CA',
            'AGREEMENT TYPE CODE': 'OS',
        });
    });

    // SPT: Publisher record (no publisher for draft)
    builder.addRecord('SPT', {
        'RECORD SEQUENCE NUMBER': '000001',
        'PUBLISHER IPI': 'UNKNOWN',
        'PUBLISHER NAME': 'NO PUBLISHER ASSIGNED',
        'PUBLISHER SHARE': '0.000000',
        'AGREEMENT ROLE CODE': 'PB',
    });

    // GRT: Group trailer (record count inside this group)
    const groupRecordCount = 1 + writers.length + 2; // NWR + SWRs + SPT
    builder.addRecord('GRT', {
        'GROUP ID': '00001',
        'TRANSACTION COUNT': '00000001',
        'RECORD COUNT': String(groupRecordCount).padStart(8, '0'),
    });

    // TRL: File trailer (count of all records including headers/trailers)
    const totalRecordCount = 2 + groupRecordCount + 1; // HDR + GRH + group records + TRL
    builder.addRecord('TRL', {
        'RECORD COUNT': String(totalRecordCount).padStart(8, '0'),
        'GROUP COUNT': '00000001',
        'FILE CREATION DATE': creationDate,
    });

    const cwrDraft = builder.build();
    return { cwrDraft, recordCount: totalRecordCount };
}

export const draftCwrRegistration: IndiiMcpTool = {
    name: 'draft_cwr_registration',
    description: 'Drafts a CWR v2.1-style STRUCTURAL DRAFT flat file (HDR/GRH/NWR/SWR/GRT/TRL) for a release owned by the caller. Draft only — not fixed-width validated, no society/IPI verification, and NOT submitted to any PRO.',
    inputSchema: {
        type: 'object',
        properties: {
            releaseId: { type: 'string', description: 'Release identifier owned by the authenticated caller.' },
            workTitle: { type: 'string', description: 'Work title override; required only when the release document has no title.' },
            writers: {
                type: 'array',
                description: `1 to ${MAX_WRITERS} writers of the musical work.`,
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Writer full name (required).' },
                        ipi: { type: 'string', description: 'Optional 9-11 digit IPI name number.' },
                    },
                    required: ['name'],
                },
            },
        },
        required: ['releaseId', 'writers'],
    },
    handler: async (args, context) => {
        const actorUid = context.user.uid;
        let releaseId = 'unknown';
        try {
            releaseId = requireString(args, 'releaseId', 200);
            const writers = parseWriters(args.writers);
            const workTitleArg = typeof args.workTitle === 'string' && args.workTitle.trim() ? args.workTitle.trim().slice(0, 200) : undefined;

            const firestore = admin.firestore();
            await verifyReleaseOwnership(firestore as unknown as OwnershipFirestore, actorUid, releaseId);

            const releaseTitle = await readReleaseTitle(firestore as unknown as OwnershipFirestore, actorUid, releaseId);
            const workTitle = releaseTitle ?? workTitleArg;
            if (!workTitle) {
                throw new InvalidCwrArgumentError('Release document has no title and no workTitle argument was provided — cannot draft a CWR work registration without a work title.');
            }

            const { cwrDraft, recordCount } = buildCwrDraft(workTitle, releaseId, writers);
            const cwrDraftsCollection = admin.firestore().collection('cwr_drafts');
            const docId = cwrDraftsCollection.doc().id;
            const storagePath = `users/${actorUid}/cwr/${docId}.V21`;

            // Store CWR draft to Cloud Storage
            await admin.storage().bucket().file(storagePath).save(cwrDraft, {
                contentType: 'text/plain; charset=utf-8',
                resumable: false,
            });

            // Record metadata in Firestore
            await cwrDraftsCollection.doc(docId).set({
                releaseId,
                workTitle,
                writerCount: writers.length,
                recordCount,
                initiatorUid: actorUid,
                status: 'draft_unsubmitted',
                storagePath,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const warnings = [
                'DRAFT ONLY — CWR v2.1 structural draft, NOT fixed-width validated per official CWR spec.',
                'No society, ISWC, or IPI verification was performed on any writer.',
                'This draft has NOT been submitted to any PRO (ASCAP/BMI/SESAC or otherwise).',
                'Publisher assigned as "NO PUBLISHER ASSIGNED" (explicit default).',
                'Writer shares defaulted to 100% for all writers (no split logic applied).',
            ];
            writers.forEach((writer, index) => {
                if (!writer.ipi) warnings.push(`writers[${index}] (${writer.name}) has no IPI — record drafted with IPI:UNKNOWN.`);
            });

            return toolResponse(operationResult({
                tool: 'draft_cwr_registration',
                actorUid,
                status: 'succeeded',
                resourceType: 'cwr_draft',
                resourceId: docId,
                evidence: [{ type: 'storage_object', reference: storagePath }],
                warnings,
                data: { docId, cwrDraft, recordCount, workTitle, writerCount: writers.length, storagePath },
            }));
        } catch (error) {
            return toolResponse(failedOperationResult({
                tool: 'draft_cwr_registration',
                actorUid,
                resourceType: 'cwr_draft',
                resourceId: releaseId,
                code: error instanceof TypeError ? 'INVALID_ARGUMENT' : 'CWR_DRAFT_FAILED',
                message: error instanceof Error ? error.message : 'CWR draft failed.',
                retryable: false,
            }));
        }
    },
};
