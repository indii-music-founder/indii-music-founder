import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { info } from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { recoverCwrTransactions, canonicalRightsJson, CwrBatchInputSchema, parseCwrAcknowledgments, correlateCwrAck, cwrAckSenderAllowed, cwrAckOutcome, reconcileCwrOutcome, type CwrTransaction, type CwrWorkOutcome } from '@indii/shared';
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function ingestCwrAck(uid: string, batchId: string, text: string, source: 'user_import' | 'receiver_transport', transport?: { filename: string; profileRevision: number }) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/rightsCwrBatches/${batchId}`);
  const batch = (await ref.get()).data();
  if (!batch) throw new HttpsError('not-found', 'Batch not found.');
  const parsed = parseCwrAcknowledgments(text);
  if (!cwrAckSenderAllowed(batch.input.recipient, parsed.sender)) throw new HttpsError('failed-precondition', 'ACK sender does not belong to this recipient route.');
  if (parsed.version !== (batch.input.version === '2.1' ? '02.10' : '02.20')) throw new HttpsError('failed-precondition', 'ACK version does not match the pinned batch.');
  const transactions = new Map<string, CwrTransaction>();
  // Recover descriptors only from the exact immutable manifest, never title matching.
  if (batch.manifestPath && batch.manifestGeneration) {
    const [bytes] = await getStorage().bucket().file(batch.manifestPath, { generation: batch.manifestGeneration }).download();
    if (digest(bytes) !== batch.manifestHash) throw new HttpsError('failed-precondition', 'Manifest checksum mismatch.');
    const input = CwrBatchInputSchema.parse(JSON.parse(bytes.toString('utf8')));
    if (digest(canonicalRightsJson(input)) !== batch.manifestHash) throw new HttpsError('failed-precondition', 'Manifest identity mismatch.');
    if (!batch.path || !batch.generation) throw new HttpsError('failed-precondition', 'Stored artifact has no immutable generation.');
    const [artifact] = await getStorage().bucket().file(batch.path, { generation: batch.generation }).download();
    if (digest(artifact) !== batch.checksum) throw new HttpsError('failed-precondition', 'Stored export checksum mismatch.');
    if (input.recipient !== batch.input.recipient || input.version !== batch.input.version || input.createdAt !== batch.input.createdAt) throw new HttpsError('failed-precondition', 'Stored batch header differs from its manifest.');
    for (const item of recoverCwrTransactions(input, artifact.toString('ascii'))) transactions.set(`${item.group}_${item.transaction}`, item);
  } else {
    for (const doc of (await ref.collection('transactions').get()).docs) transactions.set(doc.id, doc.data() as CwrTransaction);
  }
  const workAcks = parsed.acknowledgments.filter(ack => ['NWR', 'REV'].includes(ack.type));
  for (const ack of parsed.acknowledgments.filter(ack => ['HDR', 'TRL', 'GRH', 'GRT'].includes(ack.type))) {
    if ((['HDR', 'TRL'].includes(ack.type) ? ack.group !== 0 : ![...transactions.values()].some(transaction => transaction.group === ack.group)) || ack.transaction !== 0 || ack.originalDate !== batch.input.createdAt.slice(0, 10).replace(/-/g, '') || ack.originalTime !== batch.input.createdAt.slice(11, 19).replace(/:/g, '')) throw new HttpsError('failed-precondition', 'File-level ACK does not match this original transmission.');
  }
  for (const ack of workAcks) correlateCwrAck(ack, transactions.get(`${ack.group}_${ack.transaction}`), batch.input.createdAt);
  const hash = digest(text), evidenceId = `${source}_${hash}`;
  const path = `users/${uid}/rights/cwr/${batchId}/ack-${hash}.txt`;
  const object = getStorage().bucket().file(path);
  try { await object.save(text, { resumable: false, contentType: 'text/plain', preconditionOpts: { ifGenerationMatch: 0 } }); }
  catch (error) { if ((error as { code?: number }).code !== 412) throw error; }
  const [metadata] = await object.getMetadata();
  const generation = String(metadata.generation);
  const [bytes] = await getStorage().bucket().file(path, { generation }).download();
  if (digest(bytes) !== hash) throw new HttpsError('failed-precondition', 'Stored ACK checksum mismatch.');
  const evidence = ref.collection('acknowledgments').doc(evidenceId);
  // Bounded parallel ingestion, with a transaction per work. Retries repair partial imports.
  for (let offset = 0; offset < workAcks.length; offset += 20) {
    await Promise.all(workAcks.slice(offset, offset + 20).map(async ack => {
      const descriptor = transactions.get(`${ack.group}_${ack.transaction}`)!;
      const decisionRef = ref.collection('decisions').doc(`${evidenceId}_${ack.group}_${ack.transaction}`);
      const currentId = digest(`${batch.input.recipient}/${descriptor.workId}/${Number(parsed.sender)}`);
      const currentRef = db.doc(`users/${uid}/rightsSocietyOutcomes/${currentId}`);
      const incoming: CwrWorkOutcome = { revision: descriptor.revision, batchId, workId: descriptor.workId,
        ...(descriptor.entityId ? { entityId: descriptor.entityId } : {}), sender: parsed.sender,
        processingDate: ack.processingDate, status: ack.status, outcome: cwrAckOutcome(ack, parsed.sender), recipientWorkId: ack.recipientWorkId,
        source, independentlyVerified: source === 'receiver_transport', evidenceHash: hash };
      await db.runTransaction(async tx => {
        const revisionRef = db.doc(`users/${uid}/rightsCwrWorkRevisions/${digest(`${batch.input.recipient}/${descriptor.workId}`)}`);
        const [decision, current, revision] = await Promise.all([tx.get(decisionRef), tx.get(currentRef), tx.get(revisionRef)]);
        if (decision.exists) return;
        tx.create(decisionRef, { ...incoming, ...ack, recipient: batch.input.recipient, importedAt: FieldValue.serverTimestamp() });
        if ((revision.data()?.revision ?? descriptor.revision) > descriptor.revision) return;
        tx.set(currentRef, { ...reconcileCwrOutcome(current.data() as CwrWorkOutcome | undefined, incoming), recipient: batch.input.recipient, updatedAt: FieldValue.serverTimestamp() });
      });
    }));
  }
  await db.runTransaction(async tx => {
    if ((await tx.get(evidence)).exists) return;
    tx.create(evidence, { fileDecisions: parsed.acknowledgments.filter(ack => ['HDR', 'TRL', 'GRH', 'GRT'].includes(ack.type)), sender: parsed.sender, transactionCount: parsed.acknowledgments.length, path, generation, hash, source, independentlyVerified: source === 'receiver_transport', ...(transport ? { transport } : {}), importedAt: FieldValue.serverTimestamp() });
  });
  info('rights.cwr.ack', { recipient: batch.input.recipient, source, count: parsed.acknowledgments.length, ageMs: Math.max(0, Date.now() - Date.parse(batch.input.createdAt)), rejected: workAcks.filter(ack => ['RJ', 'RC'].includes(ack.status)).length });
  return { hash, ...parsed, source };
}
