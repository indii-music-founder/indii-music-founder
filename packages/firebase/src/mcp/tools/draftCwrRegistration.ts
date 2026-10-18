import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';
import { buildCwrBatch, CwrBatchInputSchema } from '@indii/shared';
import { failedOperationResult, operationResult, requireString, toolResponse, verifyReleaseOwnership } from '../helpers.js';
import type { IndiiMcpTool } from '../types.js';

export const draftCwrRegistration: IndiiMcpTool = {
  name: 'draft_cwr_registration',
  description: 'Build a fixed-width CWR 2.1/2.2 export for an owned release using explicit sender, writers, publishers, ownership and territory collection shares. Missing facts block export. Structural validation is not society verification; nothing is transmitted.',
  inputSchema: {
    type: 'object',
    properties: {
      releaseId: { type: 'string', description: 'Owned release identifier.' },
      batch: { type: 'object', description: 'CwrBatchInput: version, recipient (musicmark/the_mlc/sesac), sender {name,ipi,code}, fileSequence, createdAt ISO UTC, works with stable workId, revision, NWR/REV, category, recorded, duration HHMMSS, textMusic, writers and publishers. Parties require id/name/IPI/control/affiliations/ownership in integer hundredths of percent, territory collection, publisher chains and writer links.' },
    },
    required: ['releaseId', 'batch'],
  },
  handler: async (args, context) => {
    const actorUid = context.user.uid;
    let releaseId = 'unknown';
    try {
      releaseId = requireString(args, 'releaseId', 160);
      if (!args.batch) throw new TypeError('Provide a complete CWR batch with reviewed sender, publisher, writer and territorial shares. Names alone cannot produce a valid registration.');
      const batch = CwrBatchInputSchema.parse(args.batch);
      await verifyReleaseOwnership(admin.firestore(), actorUid, releaseId);
      const output = buildCwrBatch(batch);
      const checksum = createHash('sha256').update(output.text).digest('hex');
      const storagePath = `users/${actorUid}/rights/cwr/mcp-${checksum}/${output.filename}`;
      await admin.storage().bucket().file(storagePath).save(output.text, { resumable: false, contentType: 'text/plain' });
      await admin.firestore().collection('users').doc(actorUid).collection('cwrDrafts').doc(checksum).set({
        releaseId, status: 'draft_unsubmitted', filename: output.filename, checksum, storagePath, profileVersion: output.profileVersion,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return toolResponse(operationResult({
        tool: 'draft_cwr_registration', actorUid, status: 'succeeded', resourceType: 'cwr_draft', resourceId: checksum,
        evidence: [{ type: 'storage_object', reference: storagePath }],
        warnings: ['Export only: no society/IPI/authority verification was performed.', 'This file has NOT been submitted. Receiver onboarding and approval of exact bytes are required for delivery.'],
        data: { ...output, cwrDraft: output.text, checksum, storagePath },
      }));
    } catch (error) {
      return toolResponse(failedOperationResult({
        tool: 'draft_cwr_registration', actorUid, resourceType: 'cwr_draft', resourceId: releaseId,
        code: 'INVALID_ARGUMENT', message: error instanceof Error ? error.message : 'CWR export failed.', retryable: false,
      }));
    }
  },
};
