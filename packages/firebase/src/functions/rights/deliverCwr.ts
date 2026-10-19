import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GoogleAuth } from 'google-auth-library';
import SftpClient from 'ssh2-sftp-client';
import { info } from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';
import { SocietyDeliveryProfileSchema, isPublicSocietyIpv4, validateSocietySecretReference, type SocietyDeliveryProfile } from '@indii/shared';
import { societyOwnerHash } from './societyOnboarding';
import { ingestCwrAck } from './ingestCwrAck';
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const enabled = () => process.env.RIGHTS_CWR_DELIVERY_ENABLED === 'true';
const fail = (message: string): never => { throw new HttpsError('failed-precondition', message); };
function parseProfile(raw: FirebaseFirestore.DocumentData | undefined): SocietyDeliveryProfile {
  return SocietyDeliveryProfileSchema.parse(raw && Object.fromEntries(Object.keys(SocietyDeliveryProfileSchema.shape).map(key => [key, raw[key]])));
}
async function context(uid: string, batchId: string) {
  const db = getFirestore(), ref = db.doc(`users/${uid}/rightsCwrBatches/${batchId}`), batch = (await ref.get()).data();
  if (!batch) throw new HttpsError('not-found', 'CWR batch not found.');
  if (!enabled()) fail('Production society delivery switch is off. Export remains available.');
  const profileRef = db.doc(`users/${uid}/rightsSubmitterProfiles/${batch.input.recipient}`);
  const profile = parseProfile((await profileRef.get()).data());
  if (profile.recipient !== batch.input.recipient || profile.senderName !== batch.input.sender.name || profile.senderCode !== batch.input.sender.code || profile.senderIpi.padStart(11, '0') !== batch.input.sender.ipi.padStart(11, '0') || !profile.versions.includes(batch.input.version)) fail('Approved recipient, sender, or CWR version does not match this batch.');
  validateSocietySecretReference(profile, process.env.GCLOUD_PROJECT ?? '', societyOwnerHash(uid));
  return { db, ref, batch, profileRef, profile };
}
async function connection<T>(uid: string, profile: SocietyDeliveryProfile, operation: (client: SftpClient) => Promise<T>): Promise<T> {
  validateSocietySecretReference(profile, process.env.GCLOUD_PROJECT ?? '', societyOwnerHash(uid));
  const addresses = await lookup(profile.host, { all: true, family: 4 });
  if (!addresses.length || addresses.some(({ address }) => !isPublicSocietyIpv4(address))) fail('Recipient host is not a public approved endpoint.');
  const client = new SftpClient();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const secret = await auth.request<{ payload: { data: string } }>({ url: `https://secretmanager.googleapis.com/v1/${profile.secretVersion}:access`, timeout: 15_000 });
    const password = Buffer.from(secret.data.payload.data, 'base64').toString();
    await client.connect({ host: addresses[0].address, port: profile.port, username: profile.username, password,
      hostVerifier: (key: Buffer | string) => hash(Buffer.isBuffer(key) ? key : Buffer.from(key)) === profile.hostKeySha256, readyTimeout: 15_000 });
    return await Promise.race([operation(client), new Promise<never>((_, reject) => { timer = setTimeout(() => { void client.end().catch(() => {}); reject(new Error('Receiver operation timed out.')); }, 120_000); })]);
  } finally { if (timer) clearTimeout(timer); await client.end().catch(() => {}); }
}
async function remotePath(client: SftpClient, directory: string, filename: string) {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(filename) || filename === '.' || filename === '..') fail('Invalid receiver filename.');
  const normalized = directory.replace(/\/+$/, '') || '/';
  if (await client.realPath(normalized) !== normalized) fail('Receiver directory must be its approved canonical path, without symlink traversal.');
  return `${normalized === '/' ? '' : normalized}/${filename}`;
}
async function boundedRead(client: SftpClient, path: string, max: number): Promise<Buffer> {
  if (await client.exists(path) !== '-') fail('Receiver object must be a regular file.');
  const stat = await client.stat(path);
  if (!stat.isFile || stat.size > max) fail('Receiver file exceeds the allowed size.');
  const chunks: Buffer[] = []; let size = 0;
  await pipeline(client.createReadStream(path), new Writable({ write(chunk: Buffer, _encoding, callback) {
    size += chunk.length; if (size > max) return callback(new Error('Receiver file exceeds the allowed size.'));
    chunks.push(Buffer.from(chunk)); callback();
  } }));
  return Buffer.concat(chunks);
}
async function ensureCurrent(profileRef: FirebaseFirestore.DocumentReference, profile: SocietyDeliveryProfile) {
  const current = parseProfile((await profileRef.get()).data());
  if (current.revision !== profile.revision || !enabled()) fail('Receiver authorization changed.');
}
/** Durable claim before any write; exclusive remote creation never overwrites a receiver file. */
export async function deliverApprovedCwr(uid: string, batchId: string) {
  const { db, ref, batch, profileRef, profile } = await context(uid, batchId);
  if (!batch.generation) fail('Legacy export needs a generation-pinned artifact before delivery.');
  const [bytes] = await getStorage().bucket().file(batch.path, { generation: batch.generation }).download();
  if (hash(bytes) !== batch.checksum || batch.approval?.checksum !== batch.checksum || batch.approval?.manifestHash !== batch.manifestHash || batch.approval?.profileRevision !== profile.revision) fail('The exact file and manifest must be approved.');
  if (!batch.transactionsReady || !batch.transactionCount) fail('Transaction manifest is incomplete.');
  const transactions = await ref.collection('transactions').get();
  if (transactions.size !== batch.transactionCount) fail('Transaction manifest count differs.');
  const revisionRefs = transactions.docs.map(doc => db.doc(`users/${uid}/rightsCwrWorkRevisions/${createHash('sha256').update(`${batch.input.recipient}/${doc.data().workId}`).digest('hex')}`));
  const attemptId = randomUUID(), attemptRef = ref.collection('deliveryAttempts').doc(attemptId);
  await db.runTransaction(async tx => {
    const [latest, latestProfile] = await Promise.all([tx.get(ref), tx.get(profileRef)]);
    const revisionSnapshots = await tx.getAll(...revisionRefs);
    if (revisionSnapshots.some((snapshot, i) => snapshot.data()?.revision !== transactions.docs[i].data().revision)) fail('A composition revision is stale. Export and approve the current revision.');
    const p = parseProfile(latestProfile.data()), b = latest.data();
    if (p.revision !== profile.revision || b?.state !== 'approved_export' || b.checksum !== batch.checksum || b.manifestHash !== batch.manifestHash || b.approval?.checksum !== batch.checksum || b.approval?.manifestHash !== batch.manifestHash || b.approval?.profileRevision !== profile.revision) fail('Transfer already claimed, authorization changed, or exact approval missing.');
    tx.update(ref, { state: 'delivery_claimed', attemptId, claimedAt: FieldValue.serverTimestamp(), claimExpiresAtMs: Date.now() + 150_000 });
    tx.create(attemptRef, { attemptId, profileRevision: p.revision, checksum: batch.checksum, manifestHash: batch.manifestHash, phase: 'claimed', authorityReceiptId: p.authorityReceiptId, onboardingReceiptId: p.onboardingReceiptId, createdAt: FieldValue.serverTimestamp() });
  });
  let startedPut = false;
  try {
    await connection(uid, profile, async client => {
      const path = await remotePath(client, profile.directory, batch.filename);
      if (await client.exists(path)) fail('Receiver filename exists. Reconcile instead of overwriting.');
      await ensureCurrent(profileRef, profile);
      await attemptRef.update({ phase: 'writing', remotePath: path });
      startedPut = true;
      await pipeline(Readable.from([bytes]), client.createWriteStream(path, { flags: 'wx' }));
      await ensureCurrent(profileRef, profile);
      await db.runTransaction(async tx => {
        const latest = (await tx.get(ref)).data();
        if (latest?.attemptId !== attemptId || latest.state !== 'delivery_claimed') fail('Transfer claim changed; reconciliation required.');
        tx.update(ref, { state: 'transmitted', transportReceipt: { attemptId, checksum: batch.checksum, byteSize: bytes.length, recipient: profile.recipient, profileRevision: profile.revision, transmittedAt: FieldValue.serverTimestamp() } });
        tx.update(attemptRef, { phase: 'transmitted', completedAt: FieldValue.serverTimestamp() });
      });
    });
    info('rights.cwr.delivery', { recipient: profile.recipient, attemptId, outcome: 'transmitted', bytes: bytes.length });
    return { transmitted: true, registered: false, awaitingAcknowledgment: true };
  } catch {
    await db.runTransaction(async tx => {
      const latest = (await tx.get(ref)).data();
      if (latest?.attemptId !== attemptId || latest.state !== 'delivery_claimed') return;
      tx.update(ref, { state: startedPut ? 'delivery_outcome_unknown' : 'approved_export', errorCode: startedPut ? 'TRANSFER_REQUIRES_RECONCILIATION' : 'TRANSFER_NOT_STARTED' });
      tx.update(attemptRef, { phase: startedPut ? 'outcome_unknown' : 'not_started', completedAt: FieldValue.serverTimestamp() });
    });
    info('rights.cwr.delivery', { recipient: profile.recipient, attemptId, outcome: startedPut ? 'unknown' : 'not_started' });
    throw new HttpsError('unavailable', startedPut ? 'Transfer outcome is unknown. Reconcile with the receiver before retrying.' : 'Transfer did not start. Check receiver authorization and endpoint configuration.');
  }
}
/** A matching read establishes transport only. Missing bytes never authorize an automatic resend. */
export async function reconcileCwrTransfer(uid: string, batchId: string) {
  const { db, ref, batch, profileRef, profile } = await context(uid, batchId);
  if (!['delivery_claimed', 'delivery_outcome_unknown'].includes(batch.state) || !batch.attemptId) fail('This batch has no uncertain transfer.');
  if (batch.state === 'delivery_claimed' && Date.now() < batch.claimExpiresAtMs) fail('Transfer is still running. Wait for its claim to expire.');
  const attemptRef = ref.collection('deliveryAttempts').doc(batch.attemptId), attempt = (await attemptRef.get()).data();
  if (attempt?.profileRevision !== profile.revision) fail('Receiver configuration changed. Operator reconciliation of the original endpoint is required.');
  const checksum = await connection(uid, profile, async client => hash(await boundedRead(client, await remotePath(client, profile.directory, batch.filename), 20_000_000)));
  await ensureCurrent(profileRef, profile);
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data();
    if (!latest || latest.attemptId !== batch.attemptId || !['delivery_claimed', 'delivery_outcome_unknown'].includes(latest.state)) fail('Transfer state changed.');
    if (checksum !== batch.checksum) {
      tx.update(ref, { state: 'delivery_outcome_unknown', errorCode: 'REMOTE_BYTES_DIFFER' });
      tx.create(attemptRef.collection('evidence').doc(), { outcome: 'bytes_differ', checksum, checkedAt: FieldValue.serverTimestamp() });
    } else {
      tx.update(ref, { state: 'transmitted', transportReceipt: { checksum, attemptId: batch.attemptId, recipient: profile.recipient, reconciledAt: FieldValue.serverTimestamp() } });
      tx.create(attemptRef.collection('evidence').doc(), { outcome: 'matching_bytes', checksum, checkedAt: FieldValue.serverTimestamp() });
    }
  });
  return { transmitted: checksum === batch.checksum, registered: false };
}
export async function fetchCwrAck(uid: string, batchId: string, filename: string) {
  const { batch, profileRef, profile } = await context(uid, batchId);
  // Fetch one specifically requested file; no unbounded directory enumeration or destructive archive.
  const bytes = await connection(uid, profile, async client => boundedRead(client, await remotePath(client, profile.ackDirectory, filename), 20_000_000));
  await ensureCurrent(profileRef, profile);
  if (!bytes.equals(Buffer.from(bytes.toString('ascii'), 'ascii')) || bytes.some(byte => byte > 127)) fail('Unsupported ACK encoding.');
  if (!batch.input) fail('Batch manifest unavailable.');
  return ingestCwrAck(uid, batchId, bytes.toString('ascii'), 'receiver_transport', { filename, profileRevision: profile.revision });
}
