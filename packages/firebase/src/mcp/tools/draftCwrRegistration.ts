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

function buildCwrDraft(workTitle: string, releaseId: string, writers: CwrWriter[]): { cwrDraft: string; recordCount: number } {
    const now = new Date();
    const creationDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const creationTime = now.toISOString().slice(11, 19).replace(/:/g, '');
    const lines: string[] = [];

    lines.push('# CWR v2.1 STRUCTURAL DRAFT — NOT fixed-width validated, NOT submitted to any PRO.');
    lines.push(`HDR|SENDER:INDII MUSIC|CREATED:${creationDate}${creationTime}|VERSION:02.10|DRAFT`);
    lines.push('GRH|NWR|GROUP:00001|VERSION:02.10');
    lines.push(`NWR|WORK TITLE:${workTitle.toUpperCase()}|SUBMITTER WORK ID:${releaseId}|MUSICAL WORK DISTRIBUTION CATEGORY:POP|VERSION TYPE:ORI`);
    writers.forEach((writer, index) => {
        const seq = String(index + 1).padStart(2, '0');
        const ipiField = writer.ipi ? `IPI:${writer.ipi}` : 'IPI:UNKNOWN';
        lines.push(`SWR|SEQ:${seq}|WRITER NAME:${writer.name.toUpperCase()}|${ipiField}|ROLE:CA|SHARE:UNSPECIFIED`);
    });
    // Transaction records inside the group: 1 NWR + one SWR per writer.
    const groupRecordCount = 1 + writers.length;
    lines.push(`GRT|GROUP:00001|TRANSACTION COUNT:00000001|RECORD COUNT:${String(groupRecordCount).padStart(8, '0')}`);
    // TRL counts every record in the file including HDR/GRH/GRT/TRL.
    const totalRecordCount = groupRecordCount + 4;
    lines.push(`TRL|GROUP COUNT:00001|TRANSACTION COUNT:00000001|RECORD COUNT:${String(totalRecordCount).padStart(8, '0')}`);

    return { cwrDraft: lines.join('\n'), recordCount: totalRecordCount };
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

            const firestore = admin.firestore() as unknown as OwnershipFirestore;
            await verifyReleaseOwnership(firestore, actorUid, releaseId);

            const releaseTitle = await readReleaseTitle(firestore, actorUid, releaseId);
            const workTitle = releaseTitle ?? workTitleArg;
            if (!workTitle) {
                throw new InvalidCwrArgumentError('Release document has no title and no workTitle argument was provided — cannot draft a CWR work registration without a work title.');
            }

            const { cwrDraft, recordCount } = buildCwrDraft(workTitle, releaseId, writers);

            const warnings = [
                'DRAFT ONLY — output is a CWR v2.1 structural draft and is NOT fixed-width validated.',
                'No society or IPI verification was performed on any writer.',
                'This draft has NOT been submitted to any PRO (ASCAP/BMI/SESAC or otherwise).',
                'Writer shares are not yet specified; all writers were defaulted to role CA with SHARE:UNSPECIFIED.',
            ];
            writers.forEach((writer, index) => {
                if (!writer.ipi) warnings.push(`writers[${index}] (${writer.name}) has no IPI — record drafted with IPI:UNKNOWN.`);
            });

            return toolResponse(operationResult({
                tool: 'draft_cwr_registration',
                actorUid,
                status: 'succeeded',
                resourceType: 'cwr_draft',
                resourceId: releaseId,
                warnings,
                data: { cwrDraft, recordCount, workTitle, writerCount: writers.length },
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
