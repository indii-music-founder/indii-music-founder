import { createServer } from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { OAuth2Client } from 'google-auth-library';
import { WebSocket, WebSocketServer } from 'ws';
import { RightsId, SessionInputSchema, RIGHTS_LIMITS, type RightsCase } from '@indii/shared';
import { rememberCookies, restoreCookies } from './vault.js';

if (!getApps().length) initializeApp();
const db = getFirestore();
const instanceId = randomUUID();
const leaderRef = db.doc('rightsInfrastructure/broker');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const oauth = new OAuth2Client();
const pairs = new Map<string, { uid: string; worker?: WebSocket; client?: WebSocket; stop: () => void }>();
let draining = false;
let leaderGeneration = 0;
const send = (socket: WebSocket | undefined, value: unknown) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };

async function becomeLeader(): Promise<boolean> {
  if (draining) return false;
  return db.runTransaction(async tx => {
    const current = (await tx.get(leaderRef)).data();
    if (current?.instanceId !== instanceId && current?.expiresAtMs > Date.now()) return false;
    leaderGeneration = current?.instanceId === instanceId ? current.generation : (current?.generation ?? 0) + 1;
    tx.set(leaderRef, { instanceId, generation: leaderGeneration, expiresAtMs: Date.now() + 15_000 });
    return true;
  });
}
const heartbeat = setInterval(() => { void becomeLeader().then(ok => { if (!ok) for (const pair of pairs.values()) { pair.worker?.close(1012); pair.client?.close(1012); } }).catch(() => { for (const pair of pairs.values()) { pair.worker?.close(1012); pair.client?.close(1012); } }); }, 5000);

const server = createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(draining ? 503 : 200); res.end('ok'); }
  else { res.writeHead(404); res.end(); }
});
const ws = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  const allowed = (process.env.RIGHTS_CLIENT_ORIGINS ?? 'https://indii.music').split(',');
  if (draining || request.url !== '/session' || (origin && !allowed.includes(origin))) { socket.destroy(); return; }
  ws.handleUpgrade(request, socket, head, client => ws.emit('connection', client));
});

ws.on('connection', socket => {
  const authTimeout = setTimeout(() => socket.close(1008), 5000);
  socket.once('message', raw => {
    void (async () => {
      const packet = JSON.parse(raw.toString());
      const sessionId = RightsId.parse(packet.sessionId);
      if (!await becomeLeader()) throw new Error('Broker is draining');
      let uid: string;
      if (packet.kind === 'client') {
        if (typeof packet.ticket !== 'string' || packet.ticket.length > 100) throw new Error('Ticket required');
        uid = await db.runTransaction(async tx => {
          const ref = db.collection('rightsConnectionTickets').doc(hash(packet.ticket));
          const ticket = (await tx.get(ref)).data();
          if (!ticket || ticket.expiresAtMs <= Date.now() || ticket.sessionId !== sessionId) throw new Error('Ticket expired');
          tx.delete(ref);
          return ticket.ownerUid as string;
        });
      } else if (packet.kind === 'worker') {
        uid = RightsId.parse(packet.ownerUid);
        const identity = await oauth.verifyIdToken({ idToken: packet.identityToken, audience: process.env.RIGHTS_BROKER_URL });
        if (!process.env.RIGHTS_WORKER_SERVICE_ACCOUNT || identity.getPayload()?.email !== process.env.RIGHTS_WORKER_SERVICE_ACCOUNT || !identity.getPayload()?.email_verified) throw new Error('Worker identity rejected');
        if (typeof packet.executionSecret !== 'string' || packet.executionSecret.length > 100 || typeof packet.executionId !== 'string') throw new Error('Worker scope required');
      } else throw new Error('Unknown client');
      const ref = db.doc(`users/${uid}/rightsSessions/${sessionId}`);
      const session = (await ref.get()).data();
      if (!session || session.ownerUid !== uid || session.expiresAtMs <= Date.now() || ['ended', 'failed'].includes(session.state)) throw new Error('Session unavailable');
      if (packet.kind === 'worker') {
        const secretHash = Buffer.from(hash(packet.executionSecret));
        const expected = Buffer.from(session.executionSecretHash ?? '');
        if (secretHash.length !== expected.length || !timingSafeEqual(secretHash, expected)) throw new Error('Worker scope rejected');
        await db.runTransaction(async tx => {
          const live = (await tx.get(ref)).data();
          if (!live || (live.executionId && live.executionId !== packet.executionId)) throw new Error('Another browser execution owns this session');
          tx.update(ref, { executionId: packet.executionId, brokerGeneration: leaderGeneration, state: 'connected', control: 'none', controlGeneration: live.controlGeneration + 1 });
        });
      }
      clearTimeout(authTimeout);
      let pair = pairs.get(sessionId);
      if (!pair) {
        const unsub = ref.onSnapshot(snapshot => {
          const current = snapshot.data();
          const active = pairs.get(sessionId);
          if (!current) return;
          send(active?.client, { type: 'status', sessionId, state: current.state, control: current.control, controlGeneration: current.controlGeneration, expiresAtMs: current.expiresAtMs, paymentEnabled: current.paymentEnabled });
          if (current.requestedControl) send(active?.worker, { type: 'control', control: current.requestedControl, generation: current.controlGeneration });
        });
        const commandsUnsub = ref.collection('commands').where('state', '==', 'pending').onSnapshot(snap => {
          for (const doc of snap.docs) send(pairs.get(sessionId)?.worker, { type: 'action', commandId: doc.id, ...doc.data() });
        });
        pair = { uid, stop: () => { unsub(); commandsUnsub(); } }; pairs.set(sessionId, pair);
      }
      if (pair.uid !== uid) throw new Error('Owner mismatch');
      if (packet.kind === 'worker') {
        if (pair.worker?.readyState === WebSocket.OPEN) throw new Error('Worker already attached');
        pair.worker = socket;
        const caseData = (await db.doc(`users/${uid}/rightsCases/${session.caseId}`).get()).data();
        if (!caseData || caseData.manifestHash !== session.manifestHash) throw new Error('Manifest revision changed');
        const manifest = caseData.manifest as RightsCase;
        const deposits = await Promise.all(manifest.works.map(async work => ({ ...work.deposit, url: (await getStorage().bucket(work.deposit.bucket).file(work.deposit.path).getSignedUrl({ action: 'read', expires: Date.now() + RIGHTS_LIMITS.sessionMs, queryParams: { generation: work.deposit.generation } }))[0] })));
        send(socket, { type: 'configuration', sessionId, manifest, deposits, expiresAtMs: session.expiresAtMs, paymentEnabled: session.paymentEnabled, generation: session.controlGeneration + 1, storageState: await restoreCookies(uid).catch(() => undefined) });
        send(socket, { type: 'client_presence', connected: pair.client?.readyState === WebSocket.OPEN });
      } else {
        if (pair.client?.readyState === WebSocket.OPEN) pair.client.close(1000);
        pair.client = socket;
        send(pair.worker, { type: 'client_presence', connected: true });
        send(socket, { type: 'status', sessionId, state: session.state, control: session.control, controlGeneration: session.controlGeneration, expiresAtMs: session.expiresAtMs, paymentEnabled: session.paymentEnabled });
      }
      socket.on('message', (bytes, binary) => {
        void (async () => {
          const active = pairs.get(sessionId);
          if (!active || draining) return;
          if (packet.kind === 'client') {
            const size = Buffer.isBuffer(bytes) ? bytes.length : Array.isArray(bytes) ? bytes.reduce((sum, b) => sum + b.length, 0) : (bytes as ArrayBuffer).byteLength;
            if (size > 8192 || binary) throw new Error('Invalid input');
            const input = SessionInputSchema.parse(JSON.parse(bytes.toString()));
            if (input.sessionId !== sessionId) throw new Error('Session mismatch');
            // The worker validates the current control/nav/viewport fence before CDP input.
            send(active.worker, { type: 'input', input });
          } else if (binary) {
            if (active.client?.readyState === WebSocket.OPEN && active.client.bufferedAmount < 512 * 1024) active.client.send(bytes, { binary: true });
          } else {
            const event = JSON.parse(bytes.toString());
            if (event.type === 'control_ack') await ref.update({ control: event.control, requestedControl: FieldValue.delete(), state: 'connected' });
            else if (event.type === 'navigation') send(active.client, event);
            else if (event.type === 'activity') await ref.update({ lastActivityAtMs: Date.now() });
            else if (event.type === 'cookies') await rememberCookies(uid, event.cookies);
            else if (event.type === 'action_result') {
              const commandId = RightsId.parse(event.commandId);
              await ref.collection('commands').doc(commandId).update({ state: event.success === true ? 'completed' : 'failed', errorCode: event.success === true ? null : 'TARGET_NOT_VERIFIED' });
              send(active.client, { type: 'action_result', success: event.success === true });
            } else if (event.type === 'ended') {
              await ref.update({ state: 'ended', control: 'none' });
              await db.doc(`users/${uid}/rightsFilings/${session.filingId}`).update({ state: 'outcome_unknown' });
              active.stop(); active.client?.close(1000); pairs.delete(sessionId);
            }
          }
        })().catch(() => { send(socket, { type: 'error', code: 'SESSION_OPERATION_FAILED' }); });
      });
      socket.on('close', () => {
        const active = pairs.get(sessionId);
        if (!active) return;
        if (packet.kind === 'client' && active.client === socket) { active.client = undefined; send(active.worker, { type: 'client_presence', connected: false }); }
        if (packet.kind === 'worker' && active.worker === socket) {
          active.worker = undefined;
          void ref.update({ control: 'none', state: 'reconnecting' }).catch(() => {});
        }
      });
      socket.on('error', () => socket.close());
    })().catch(() => { clearTimeout(authTimeout); socket.close(1008, 'Session authorization failed'); });
  });
});

process.on('SIGTERM', () => {
  draining = true; clearInterval(heartbeat);
  for (const pair of pairs.values()) { pair.stop(); pair.worker?.close(1012); pair.client?.close(1012); }
  server.close();
});
server.listen(Number(process.env.PORT ?? 8080));
