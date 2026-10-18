import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GoogleAuth } from 'google-auth-library';
import SftpClient from 'ssh2-sftp-client';
import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

const Profile = z.object({
  approved: z.literal(true), authorityReceiptId: z.string().min(1), onboardingReceiptId: z.string().min(1),
  senderIpi: z.string().regex(/^\d{9,11}$/), recipient: z.enum(['musicmark', 'the_mlc', 'sesac']),
  host: z.string().regex(/^[a-zA-Z0-9.-]+$/), port: z.number().int().min(1).max(65535),
  hostKeySha256: z.string().regex(/^[a-f0-9]{64}$/), directory: z.string().regex(/^\/[A-Za-z0-9_./-]*$/),
  username: z.string().min(1).max(200), secretVersion: z.string().regex(/^projects\/[A-Za-z0-9_-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[0-9]+$/),
}).strict();
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');

/** Approval is claimed before any transfer; an uncertain put is never retried. */
export async function deliverApprovedCwr(uid: string, batchId: string) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/rightsCwrBatches/${batchId}`);
  const batch = (await ref.get()).data();
  if (!batch) throw new HttpsError('not-found', 'CWR batch not found.');
  if (process.env.RIGHTS_CWR_DELIVERY_ENABLED !== 'true') throw new HttpsError('failed-precondition', 'Official submitter delivery is not enabled.');
  const profile = Profile.parse((await db.doc(`users/${uid}/rightsSubmitterProfiles/${batch.input.recipient}`).get()).data());
  if (profile.senderIpi.padStart(11, '0') !== batch.input.sender.ipi.padStart(11, '0')) throw new HttpsError('permission-denied', 'This approved submitter does not match the file sender.');
  const addresses = await lookup(profile.host, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address))) throw new HttpsError('failed-precondition', 'Recipient host is not a public approved endpoint.');
  const [bytes] = await getStorage().bucket().file(batch.path, batch.generation ? { generation: batch.generation } : undefined).download();
  if (hash(bytes) !== batch.checksum || batch.approval?.checksum !== batch.checksum || batch.approval?.manifestHash !== batch.manifestHash) throw new HttpsError('failed-precondition', 'The exact file and manifest must be approved.');
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data();
    if (latest?.state !== 'approved_export' || latest.checksum !== batch.checksum || latest.manifestHash !== batch.manifestHash || latest.approval?.checksum !== batch.checksum || latest.approval?.manifestHash !== batch.manifestHash) throw new HttpsError('failed-precondition', 'This transfer is already claimed or requires reconciliation.');
    tx.update(ref, { state: 'delivery_claimed', claimedAt: FieldValue.serverTimestamp(), authorityReceiptId: profile.authorityReceiptId, onboardingReceiptId: profile.onboardingReceiptId });
  });
  const client = new SftpClient();
  let startedPut = false;
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const secret = await auth.request<{ payload: { data: string } }>({ url: `https://secretmanager.googleapis.com/v1/${profile.secretVersion}:access` });
    const password = Buffer.from(secret.data.payload.data, 'base64').toString();
    await client.connect({ host: addresses[0].address, port: profile.port, username: profile.username, password,
      hostVerifier: (key: Buffer | string) => hash(Buffer.isBuffer(key) ? key : Buffer.from(key)) === profile.hostKeySha256, readyTimeout: 15_000 });
    const path = profile.directory.replace(/\/$/, '') + '/' + batch.filename;
    if (await client.exists(path)) throw new HttpsError('failed-precondition', 'Recipient filename already exists; reconcile it instead of overwriting.');
    startedPut = true;
    await client.put(bytes, path);
    await ref.update({ state: 'transmitted', transportReceipt: { checksum: batch.checksum, byteSize: bytes.length, recipient: profile.recipient, transmittedAt: FieldValue.serverTimestamp() } });
    return { transmitted: true, registered: false, awaitingAcknowledgment: true };
  } catch {
    await ref.update({ state: startedPut ? 'delivery_outcome_unknown' : 'approved_export', errorCode: startedPut ? 'TRANSFER_REQUIRES_RECONCILIATION' : 'TRANSFER_NOT_STARTED' });
    throw new HttpsError('unavailable', startedPut ? 'Transfer outcome is unknown. Reconcile with the receiver before retrying.' : 'Transfer did not start. Check official submitter authorization and endpoint configuration.');
  } finally { await client.end().catch(() => {}); }
}
