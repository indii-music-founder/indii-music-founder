import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleAuth } from 'google-auth-library';
import { z } from 'zod';
import { RightsId, RightsCaseSchema, RightsEvidenceSchema, CwrBatchInputSchema, buildCwrBatch, parseCwrAcknowledgments,
  canonicalRightsJson, validateCopyrightCase, RIGHTS_LIMITS, isRightsSessionClosed, type RightsCase } from '@indii/shared';
import { deliverApprovedCwr } from './deliverCwr';
import { prepareSoundExchangeBulk } from '@indii/shared';
import { createCanonicalMusicCatalogStore } from '../music/canonicalMusicCatalogStore';
import { validateRightsEntityReferences, CanonicalMusicEntitySchema, RightsEntityId, COPYRIGHT_PORTAL_HOSTS, canApproveCwrExport, publicRightsSession } from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const db = () => getFirestore();
const root = (uid: string) => db().collection('users').doc(uid);
const Request = z.object({ action: z.enum(['capabilities', 'list_sessions', 'catalog_entities', 'create_entity', 'save_case', 'prepare_deposit', 'record_evidence', 'build_cwr', 'prepare_soundexchange', 'deliver_cwr', 'approve_cwr', 'import_ack', 'start_session', 'connect_ticket', 'take_control', 'return_control', 'execute_action', 'select_deposits', 'end_session', 'remember_login', 'forget_login']), payload: z.record(z.unknown()) }).strict();
const CaseId = z.object({ caseId: RightsId }).passthrough();
const SessionId = z.object({ sessionId: RightsId }).passthrough();
const gc = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const SAFE_BUCKET = () => getStorage().bucket();
const portalConsent = (uid: string) => root(uid).collection('rightsPortalConsents').doc('loc_copyright');

async function ownedCase(uid: string, id: string) {
  const snap = await root(uid).collection('rightsCases').doc(id).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Filing case not found.');
  return snap.data()! as { manifest: RightsCase; manifestHash: string; filingId: string };
}
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function prepareDeposit(uid: string, payload: Record<string, unknown>) {
  const input = z.object({ path: z.string().max(500), generation: z.string().regex(/^[1-9][0-9]*$/) }).strict().parse(payload);
  if (!input.path.startsWith(`users/${uid}/rights/deposits/`) || input.path.includes('..')) throw new HttpsError('permission-denied', 'Select your own uploaded deposit.');
  const bucket = SAFE_BUCKET();
  const original = bucket.file(input.path, { generation: input.generation });
  const [metadata] = await original.getMetadata();
  const size = Number(metadata.size);
  if (!size || size > RIGHTS_LIMITS.depositBytes) throw new HttpsError('invalid-argument', 'Deposit exceeds the 500 MB limit.');
  const mime = metadata.contentType ?? '';
  if (!['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aiff', 'audio/flac', 'application/pdf'].includes(mime)) throw new HttpsError('invalid-argument', 'Unsupported deposit type.');
  const dir = await mkdtemp(join(tmpdir(), 'rights-deposit-'));
  try {
    const source = join(dir, 'source');
    await original.download({ destination: source });
    const sha256 = await fileHash(source);
    let output = source;
    if (mime === 'audio/flac') {
      output = join(dir, 'deposit.wav');
      const ffmpeg = (await import('ffmpeg-static')).default;
      if (!ffmpeg) throw new HttpsError('unavailable', 'Audio conversion is unavailable.');
      await promisify(execFile)(ffmpeg, ['-nostdin', '-v', 'error', '-i', source, '-vn', '-c:a', 'pcm_s16le', output], { timeout: 120_000, maxBuffer: 4096 });
    }
    const outputHash = await fileHash(output);
    const outputSize = (await stat(output)).size;
    if (outputSize > RIGHTS_LIMITS.depositBytes) throw new HttpsError('invalid-argument', 'Converted deposit exceeds 500 MB.');
    const extension = mime === 'audio/flac' || mime === 'audio/wav' ? 'wav' : mime === 'application/pdf' ? 'pdf' : mime === 'audio/aiff' ? 'aiff' : mime === 'audio/mp4' ? 'm4a' : 'mp3';
    const path = `users/${uid}/rights/verified-deposits/${outputHash}.${extension}`;
    const destination = bucket.file(path);
    try { await bucket.upload(output, { destination: path, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: mime === 'audio/flac' ? 'audio/wav' : mime } }); }
    catch (error) { if ((error as { code?: number }).code !== 412) throw error; }
    const [saved] = await destination.getMetadata();
    const asset = { bucket: bucket.name, path, generation: String(saved.generation), sha256: outputHash,
      filename: `${outputHash}.${extension}`, mimeType: mime === 'audio/flac' ? 'audio/wav' : mime, byteSize: outputSize,
      ...(mime === 'audio/flac' ? { convertedFrom: { generation: input.generation, sha256, mimeType: mime } } : {}),
    };
    await root(uid).collection('rightsAssets').doc(outputHash).set({ ...asset, verifiedAt: FieldValue.serverTimestamp() });
    return asset;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

export const rightsRegistration = onCall({ enforceAppCheck: false, timeoutSeconds: 540, memory: '2GiB' }, async request => {
  validateAppCheckV2(request);
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Sign in to manage your filings.');
  const uid = request.auth.uid;
  try {
    const { action, payload } = Request.parse(request.data);
    if (action === 'capabilities') return { hostedEnabled: process.env.RIGHTS_HOSTED_ENABLED === 'true', paymentEnabled: process.env.RIGHTS_PAYMENT_ENABLED === 'true', rememberEnabled: Boolean(process.env.RIGHTS_VAULT_BUCKET && process.env.RIGHTS_KMS_KEY && process.env.RIGHTS_AUTH_COOKIE_NAMES && COPYRIGHT_PORTAL_HOSTS.includes(process.env.RIGHTS_AUTH_COOKIE_HOST ?? '')) };
    if (action === 'list_sessions') {
      z.object({}).strict().parse(payload);
      const active = (await db().doc('rightsInfrastructure/capacity').get()).data()?.active ?? {};
      const ids = Object.entries(active).filter(([id, value]) => RightsId.safeParse(id).success && (value as { uid?: unknown })?.uid === uid).map(([id]) => id);
      if (!ids.length) return { sessions: [] };
      const snapshots = await db().getAll(...ids.map(id => root(uid).collection('rightsSessions').doc(id)));
      return { sessions: snapshots.flatMap(snapshot => {
        const session = publicRightsSession(uid, snapshot.id, snapshot.data() ?? {}, Date.now());
        return session ? [session] : [];
      }) };
    }
    if (action === 'catalog_entities') {
      const input = z.object({ after: z.string().min(1).max(160).optional() }).strict().parse(payload);
      let query = root(uid).collection('musicCatalogEntities').orderBy('__name__').limit(200);
      if (input.after) query = query.startAfter(input.after);
      const page = await query.get();
      return { entities: page.docs.map(doc => CanonicalMusicEntitySchema.parse(doc.data())).filter(entity => ['person', 'organization', 'musical_work', 'sound_recording'].includes(entity.entityType)), next: page.size === 200 ? page.docs.at(-1)!.id : null };
    }
    if (action === 'create_entity') {
      const input = z.object({ entityType: z.enum(['person', 'organization', 'musical_work', 'sound_recording']), name: z.string().trim().min(1).max(500) }).strict().parse(payload);
      const now = new Date().toISOString();
      return createCanonicalMusicCatalogStore().appendEntity(uid, { kind: 'user', id: uid }, {
        schemaVersion: 'canonical-music-entity.v1', id: randomUUID(), entityType: input.entityType,
        createdAt: now, updatedAt: now,
        ...(input.entityType === 'person' ? { displayName: input.name, legalName: input.name } : input.entityType === 'organization' ? { name: input.name } : { title: input.name }),
        provenance: { state: 'USER_DECLARED', sourceType: 'USER', sourceId: uid, evidence: [], observedAt: now, note: 'Explicitly created during rights preparation; identity does not establish ownership or filing authority.' },
      });
    }
    if (action === 'prepare_deposit') return await prepareDeposit(uid, payload);
    if (action === 'save_case') {
      const manifest = RightsCaseSchema.parse(payload);
      for (const track of new Set(manifest.works.flatMap(w => w.trackIds))) {
        if (!(await root(uid).collection('tracks').doc(track).get()).exists) throw new HttpsError('permission-denied', 'Every work must reference your catalog.');
      }
      for (const work of manifest.works) {
        const asset = await root(uid).collection('rightsAssets').doc(work.deposit.sha256).get();
        const stored = asset.data();
        if (!stored || work.deposit.path !== stored.path || work.deposit.generation !== stored.generation || work.deposit.bucket !== stored.bucket || work.deposit.byteSize !== stored.byteSize) throw new HttpsError('failed-precondition', 'Prepare and verify each uploaded deposit first.');
      }
      if (manifest.works.reduce((sum, w) => sum + w.deposit.byteSize, 0) > 1024 ** 3) throw new HttpsError('invalid-argument', 'The filing deposit bundle exceeds 1 GB.');
      const entityRefs = [...new Set([...manifest.parties.map(p => p.entityId), ...manifest.works.map(w => w.entityId)])];
      const entities = await Promise.all(entityRefs.map(async id => {
        const snapshot = await root(uid).collection('musicCatalogEntities').doc(id).get();
        if (!snapshot.exists) throw new HttpsError('failed-precondition', 'Link each party and work to your canonical catalog identity before saving.');
        return CanonicalMusicEntitySchema.parse(snapshot.data());
      }));
      const identityErrors = validateRightsEntityReferences(manifest, entities);
      if (identityErrors.length) throw new HttpsError('failed-precondition', identityErrors.join(' '));
      const errors = validateCopyrightCase(manifest);
      const manifestHash = digest(canonicalRightsJson(manifest));
      const filingId = `${manifest.caseId}_r${manifest.revision}`;
      const ref = root(uid).collection('rightsCases').doc(manifest.caseId);
      await db().runTransaction(async tx => {
        const existing = await tx.get(ref);
        const data = existing.data();
        if (data?.manifestHash === manifestHash) return;
        if (manifest.revision !== (data?.manifest?.revision ?? 0) + 1) throw new HttpsError('aborted', 'Reload the latest case revision before saving.');
        tx.set(ref, { ownerUid: uid, manifest, manifestHash, filingId, errors, updatedAt: FieldValue.serverTimestamp() });
        tx.create(root(uid).collection('rightsFilings').doc(filingId), { ownerUid: uid, caseId: manifest.caseId, revision: manifest.revision,
          manifestHash, manifest, state: errors.length ? 'needs_information' : 'ready', evidenceSource: 'none', provider: 'loc_copyright', createdAt: FieldValue.serverTimestamp() });
      });
      return { caseId: manifest.caseId, filingId, manifestHash, errors };
    }
    if (action === 'record_evidence') {
      const input = z.object({ caseId: RightsId, filingId: RightsId.optional(), evidence: RightsEvidenceSchema }).strict().parse(payload);
      const filing = await ownedCase(uid, input.caseId);
      // Client assertions cannot promote submission, acceptance, or registration.
      const ref = root(uid).collection('rightsFilings').doc(input.filingId ?? filing.filingId);
      if ((await ref.get()).data()?.caseId !== input.caseId) throw new HttpsError('permission-denied', 'Receipt does not belong to this case.');
      await db().runTransaction(async tx => {
        const existing = await tx.get(ref.collection('evidence').doc(input.evidence.evidenceId));
        if (existing.exists) {
          if (existing.data()?.hash !== digest(canonicalRightsJson(input.evidence))) throw new HttpsError('already-exists', 'Evidence ID already identifies another receipt.');
          return;
        }
        const current = await tx.get(ref);
        tx.create(ref.collection('evidence').doc(input.evidence.evidenceId), { evidence: input.evidence, hash: digest(canonicalRightsJson(input.evidence)), source: 'user_report', createdAt: FieldValue.serverTimestamp() });
        if (!['submitted', 'accepted', 'registered', 'rejected'].includes(current.data()?.state)) tx.update(ref, { state: 'outcome_unknown', evidenceSource: 'user_report', reportedExternalId: input.evidence.externalId });
      });
      return { filingId: input.filingId ?? filing.filingId, saved: true, source: 'user_report' };
    }
    if (action === 'deliver_cwr') return deliverApprovedCwr(uid, RightsId.parse(payload.batchId));
    if (action === 'prepare_soundexchange') {
      const templateId = RightsId.parse(payload.templateId);
      const profile = (await db().doc(`rightsInfrastructure/soundexchange/templates/${templateId}`).get()).data();
      if (!profile) throw new HttpsError('failed-precondition', 'An authenticated official SoundExchange template must be reviewed before bulk export.');
      return { ...prepareSoundExchangeBulk(profile.template, payload.recordings), delivered: false };
    }
    if (action === 'build_cwr') {
      const input = CwrBatchInputSchema.parse(payload);
      const result = buildCwrBatch(input);
      const checksum = digest(result.text);
      const manifestHash = digest(canonicalRightsJson(input));
      const batchId = `cwr_${checksum.slice(0, 32)}_${manifestHash.slice(0, 24)}`;
      const path = `users/${uid}/rights/cwr/${batchId}/${result.filename}`;
      const object = SAFE_BUCKET().file(path);
      try { await object.save(result.text, { contentType: 'text/plain', resumable: false, preconditionOpts: { ifGenerationMatch: 0 } }); }
      catch (error) { if ((error as { code?: number }).code !== 412) throw error; }
      const [objectMetadata] = await object.getMetadata();
      const generation = String(objectMetadata.generation);
      const [persistedBytes] = await SAFE_BUCKET().file(path, { generation }).download();
      if (digest(persistedBytes) !== checksum) throw new HttpsError('failed-precondition', 'Stored batch bytes do not match the export.');
      const batchRef = root(uid).collection('rightsCwrBatches').doc(batchId);
      await db().runTransaction(async tx => {
        const filenameRef = root(uid).collection('rightsCwrFilenames').doc(result.filename);
        const filenameClaim = (await tx.get(filenameRef)).data();
        const existing = await tx.get(batchRef);
        if (existing.exists) return;
        if (filenameClaim && filenameClaim.batchId !== batchId) throw new HttpsError('already-exists', 'Use a new file sequence; this recipient filename already identifies another batch.');
        const { works: _works, ...header } = input;
        tx.set(filenameRef, { batchId, checksum });
        tx.create(batchRef, { input: header, manifestHash, checksum, path, generation, filename: result.filename, profileVersion: result.profileVersion, state: 'exported', createdAt: FieldValue.serverTimestamp() });
      });
      const writer = db().bulkWriter();
      for (const item of result.transactions) writer.set(batchRef.collection('transactions').doc(`${item.group}_${item.transaction}`), item);
      await writer.close();
      return { batchId, ...result, checksum, state: 'exported', transportEnabled: false };
    }
    if (action === 'approve_cwr') {
      const input = z.object({ batchId: RightsId, checksum: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(payload);
      const ref = root(uid).collection('rightsCwrBatches').doc(input.batchId);
      await db().runTransaction(async tx => {
        const batch = (await tx.get(ref)).data();
        if (!batch || batch.checksum !== input.checksum || !canApproveCwrExport(batch.state)) throw new HttpsError('failed-precondition', 'Approve the exact current export. Claimed or transmitted files require reconciliation.');
        tx.update(ref, { approval: { approverUid: uid, checksum: input.checksum, manifestHash: batch.manifestHash, approvedAt: FieldValue.serverTimestamp() }, state: 'approved_export' });
      });
      return { state: 'approved_export', delivered: false, reason: 'Receiver-approved submitter transport is not configured. Download this approved file for official delivery.' };
    }
    if (action === 'import_ack') {
      const input = z.object({ batchId: RightsId, text: z.string().max(20_000_000) }).strict().parse(payload);
      const ref = root(uid).collection('rightsCwrBatches').doc(input.batchId);
      const batch = (await ref.get()).data();
      if (!batch) throw new HttpsError('not-found', 'Batch not found.');
      const parsed = parseCwrAcknowledgments(input.text);
      const created = batch.input.createdAt as string;
      for (const ack of parsed.acknowledgments) {
        const match = (await ref.collection('transactions').doc(`${ack.group}_${ack.transaction}`).get()).data();
        if (!match || match.workId !== ack.workId || match.type && match.type !== ack.type || ack.originalDate !== created.slice(0, 10).replace(/-/g, '') || ack.originalTime !== created.slice(11, 19).replace(/:/g, '')) throw new HttpsError('failed-precondition', 'ACK cannot be unambiguously correlated to this batch.');
      }
      const hash = digest(input.text);
      const path = `users/${uid}/rights/cwr/${input.batchId}/ack-${hash}.txt`;
      await SAFE_BUCKET().file(path).save(input.text, { resumable: false, contentType: 'text/plain' });
      await db().runTransaction(async tx => {
        const ackRef = ref.collection('acknowledgments').doc(hash);
        if ((await tx.get(ackRef)).exists) return;
        tx.create(ackRef, { sender: parsed.sender, transactionCount: parsed.acknowledgments.length, path, hash, source: 'user_import', independentlyVerified: false, importedAt: FieldValue.serverTimestamp() });
      });
      const writer = db().bulkWriter();
      for (const ack of parsed.acknowledgments) writer.set(ref.collection('decisions').doc(`${hash}_${ack.group}_${ack.transaction}`), { ...ack, source: 'user_import', independentlyVerified: false, batchId: input.batchId });
      await writer.close();
      return { hash, ...parsed, source: 'user_import' };
    }
    if (action === 'remember_login' || action === 'forget_login') {
      const enabled = action === 'remember_login';
      await db().runTransaction(async tx => {
        const ref = portalConsent(uid);
        const version = ((await tx.get(ref)).data()?.version ?? 0) + 1;
        tx.set(ref, { enabled, version, expiresAtMs: enabled ? Date.now() + RIGHTS_LIMITS.rememberMs : 0, updatedAt: FieldValue.serverTimestamp() });
      });
      if (!enabled && process.env.RIGHTS_VAULT_BUCKET) await getStorage().bucket(process.env.RIGHTS_VAULT_BUCKET).deleteFiles({ prefix: `auth/${uid}/loc_copyright/`, versions: true });
      return { enabled, retentionDays: 7 };
    }
    if (action === 'start_session') {
      const { caseId } = CaseId.parse(payload);
      if (process.env.RIGHTS_HOSTED_ENABLED !== 'true') throw new HttpsError('failed-precondition', 'Hosted filing is awaiting deployment and genuine acceptance verification.');
      const filing = await ownedCase(uid, caseId);
      if (payload.manifestHash !== filing.manifestHash) throw new HttpsError('failed-precondition', 'Review and save the current manifest before launching.');
      const errors = validateCopyrightCase(filing.manifest);
      if (errors.length) throw new HttpsError('failed-precondition', errors.join(' '));
      const project = process.env.GCLOUD_PROJECT;
      const job = process.env.RIGHTS_BROWSER_JOB;
      const brokerUrl = process.env.RIGHTS_BROKER_URL;
      if (!project || !job || !brokerUrl) throw new HttpsError('failed-precondition', 'Hosted browser infrastructure is not configured.');
      const sessionId = randomUUID();
      const workerSecret = randomBytes(32).toString('base64url');
      const ref = root(uid).collection('rightsSessions').doc(sessionId);
      await db().runTransaction(async tx => {
        const capacityRef = db().doc('rightsInfrastructure/capacity');
        const capacity = (await tx.get(capacityRef)).data() ?? {};
        // Expired reservations remain occupied until shutdown is confirmed by recovery.
        const active = (capacity.active ?? {}) as Record<string, { uid: string; expiresAtMs: number }>;
        if (Object.values(active).some(s => s.uid === uid) || Object.keys(active).length >= RIGHTS_LIMITS.globalSessions) throw new HttpsError('resource-exhausted', 'Browser capacity is occupied. End your active session or try again later.');
        const filingRef = root(uid).collection('rightsFilings').doc(filing.filingId);
        const currentFiling = (await tx.get(filingRef)).data();
        if (['in_progress', 'submitted', 'accepted', 'registered', 'outcome_unknown'].includes(currentFiling?.state)) throw new HttpsError('failed-precondition', 'Reconcile this filing before starting another session.');
        const expiresAtMs = Date.now() + RIGHTS_LIMITS.sessionMs;
        tx.set(capacityRef, { active: { ...active, [sessionId]: { uid, expiresAtMs } } });
        tx.create(ref, { ownerUid: uid, caseId, filingId: filing.filingId, manifestHash: filing.manifestHash, state: 'queued', control: 'none', controlGeneration: 0,
          executionSecretHash: digest(workerSecret), createdAtMs: Date.now(), jobResource: `projects/${project}/locations/us-central1/jobs/${job}`, expiresAtMs, lastActivityAtMs: Date.now(), paymentEnabled: process.env.RIGHTS_PAYMENT_ENABLED === 'true', createdAt: FieldValue.serverTimestamp() });
        tx.update(filingRef, { state: 'in_progress' });
      });
      try {
        const response = await gc.request<{ name?: string }>({ method: 'POST', retry: false, url: `https://run.googleapis.com/v2/projects/${project}/locations/us-central1/jobs/${job}:run`,
          data: { overrides: { containerOverrides: [{ env: [{ name: 'RIGHTS_SESSION_ID', value: sessionId }, { name: 'RIGHTS_OWNER_UID', value: uid }, { name: 'RIGHTS_EXECUTION_SECRET', value: workerSecret }, { name: 'RIGHTS_BROKER_URL', value: brokerUrl }] }], taskCount: 1, timeout: '7500s' } } });
        await db().runTransaction(async tx => {
          const live = (await tx.get(ref)).data();
          if (live) tx.update(ref, { operationName: response.data.name ?? null, ...(live.state === 'queued' ? { state: 'starting' } : {}) });
        });
      } catch {
        await db().runTransaction(async tx => {
          const live = (await tx.get(ref)).data();
          const filingRef = root(uid).collection('rightsFilings').doc(filing.filingId);
          const current = (await tx.get(filingRef)).data();
          if (!live || ['ended', 'failed'].includes(live.state)) return;
          tx.update(ref, { state: 'termination_pending', requestedControl: 'end', control: 'none', controlGeneration: live.controlGeneration + 1, stopReason: 'launch_unconfirmed', errorCode: 'DISPATCH_UNCONFIRMED' });
          if (current?.state === 'in_progress') tx.update(filingRef, { state: 'outcome_unknown' });
        });
        throw new HttpsError('unavailable', 'Browser launch could not be confirmed. Do not retry until this session is reconciled.');
      }
      return { sessionId, brokerUrl: process.env.RIGHTS_BROKER_URL };
    }
    const { sessionId } = SessionId.parse(payload);
    const ref = root(uid).collection('rightsSessions').doc(sessionId);
    if (action === 'connect_ticket') {
      const ticket = randomBytes(32).toString('base64url');
      await db().runTransaction(async tx => {
        const session = (await tx.get(ref)).data();
        if (!session || session.expiresAtMs <= Date.now() || isRightsSessionClosed(session.state)) throw new HttpsError('failed-precondition', 'Session has ended.');
        tx.create(db().collection('rightsConnectionTickets').doc(digest(ticket)), { ownerUid: uid, sessionId, expiresAtMs: Date.now() + RIGHTS_LIMITS.ticketMs });
      });
      return { ticket, brokerUrl: process.env.RIGHTS_BROKER_URL };
    }
    if (action === 'select_deposits') {
      const input = z.object({ sessionId: RightsId, requestId: RightsId, workIds: z.array(RightsEntityId).min(1).max(40) }).strict().parse(payload);
      await db().runTransaction(async tx => {
        const session = (await tx.get(ref)).data();
        if (!session || session.control !== 'human' || session.state !== 'connected' || session.expiresAtMs <= Date.now()) throw new HttpsError('failed-precondition', 'Take control before selecting deposits.');
        const filing = (await tx.get(root(uid).collection('rightsFilings').doc(session.filingId))).data();
        const manifest = RightsCaseSchema.parse(filing?.manifest);
        if (new Set(input.workIds).size !== input.workIds.length || input.workIds.some(id => !manifest.works.some(w => w.entityId === id))) throw new HttpsError('invalid-argument', 'Select deposits from this filing only.');
        tx.create(ref.collection('commands').doc(randomUUID()), { actionId: 'select_deposits', requestId: input.requestId, workIds: input.workIds, generation: session.controlGeneration, state: 'pending', createdAtMs: Date.now() });
      });
      return { requested: true };
    }
    if (action === 'execute_action') {
      const actionId = z.enum(['open_application', 'fill_title', 'fill_year']).parse(payload.actionId);
      await db().runTransaction(async tx => {
        const session = (await tx.get(ref)).data();
        if (!session || session.control !== 'agent' || session.state !== 'connected' || session.expiresAtMs <= Date.now()) throw new HttpsError('failed-precondition', 'Return control to the assistant first.');
        tx.create(ref.collection('commands').doc(randomUUID()), { actionId, generation: session.controlGeneration, state: 'pending', createdAtMs: Date.now() });
      });
      return { requested: true };
    }
    if (action === 'end_session' || action === 'take_control' || action === 'return_control') {
      await db().runTransaction(async tx => {
        const snap = await tx.get(ref);
        const session = snap.data();
        if (!session || ['ended', 'failed'].includes(session.state) || (action !== 'end_session' && (session.expiresAtMs <= Date.now() || isRightsSessionClosed(session.state)))) throw new HttpsError('failed-precondition', 'Session has ended.');
        tx.update(ref, { ...(action === 'end_session' ? { state: 'termination_pending', stopReason: 'artist_requested' } : {}), requestedControl: action === 'take_control' ? 'human' : action === 'return_control' ? 'agent' : 'end',
          control: 'none', controlGeneration: session.controlGeneration + 1, lastActivityAtMs: Date.now() });
      });
      return { requested: true };
    }
    throw new HttpsError('invalid-argument', 'Unsupported rights action.');
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof z.ZodError) throw new HttpsError('invalid-argument', error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
    // Do not return storage paths, input content or third-party responses in errors.
    throw new HttpsError('internal', 'The rights operation failed. Your external filing was not retried.');
  }
});
