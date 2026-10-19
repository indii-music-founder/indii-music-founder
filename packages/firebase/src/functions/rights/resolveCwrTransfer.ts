import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { RightsId } from '@indii/shared';
/** Explicit operator reconciliation with auditable evidence; never retries a remote operation. */
export async function resolveCwrTransfer(actorUid: string, admin: boolean, payload: Record<string, unknown>) {
  if (!admin) throw new HttpsError('permission-denied', 'Receiver evidence must be reviewed by an authorized operator.');
  const input = z.object({ ownerUid: z.string().min(1).max(128).refine(id => !id.includes('/')), batchId: RightsId, attemptId: z.string().uuid(), receiptId: z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/), outcome: z.enum(['transmitted', 'not_transmitted']) }).strict().parse(payload);
  const db = getFirestore(), ref = db.doc(`users/${input.ownerUid}/rightsCwrBatches/${input.batchId}`);
  await db.runTransaction(async tx => {
    const batch = (await tx.get(ref)).data();
    if (!batch || batch.attemptId !== input.attemptId || !['delivery_claimed', 'delivery_outcome_unknown'].includes(batch.state)) throw new HttpsError('failed-precondition', 'The uncertain attempt no longer matches.');
    if (batch.state === 'delivery_claimed' && Date.now() < batch.claimExpiresAtMs) throw new HttpsError('failed-precondition', 'The transfer is still running.');
    const evidence = { actorUid, receiptId: input.receiptId, source: 'operator_review', outcome: input.outcome, reviewedAt: FieldValue.serverTimestamp() };
    tx.create(ref.collection('deliveryAttempts').doc(input.attemptId).collection('evidence').doc(), evidence);
    tx.update(ref, input.outcome === 'transmitted' ? { state: 'transmitted', transportReceipt: { ...evidence, checksum: batch.checksum, attemptId: input.attemptId } } : { state: 'exported', approval: FieldValue.delete(), errorCode: FieldValue.delete(), lastReconciliation: evidence });
  });
  return { state: input.outcome === 'transmitted' ? 'transmitted' : 'exported', registered: false, requiresNewApproval: input.outcome === 'not_transmitted' };
}
