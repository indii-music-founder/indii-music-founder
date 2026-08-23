import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHash, randomBytes } from 'crypto';

const LEASE_MS = 10 * 60 * 1000;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ENROLLMENT_SECRET = /^[A-Za-z0-9_-]{32,256}$/;
const REMOTE_RELAY_PROTOCOL_VERSION = 1;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

async function assertLease(uid: string, deviceId: unknown, leaseToken: unknown) {
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId) || typeof leaseToken !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid Studio executor lease.');
  }
  const ref = admin.firestore().doc(`users/${uid}/studioExecutors/${deviceId}`);
  const snapshot = await ref.get();
  const expiresAt = snapshot.get('leaseExpiresAt') as admin.firestore.Timestamp | undefined;
  if (!snapshot.exists || snapshot.get('activeLeaseToken') !== leaseToken || !expiresAt || expiresAt.toMillis() <= Date.now()) {
    throw new HttpsError('permission-denied', 'Studio executor lease is missing or expired.');
  }
  return { deviceId, ref };
}

/**
 * A Studio-only credential is stored by Electron's encrypted keychain. The
 * renderer may request a lease only by presenting that secret; browsers and
 * Controllers do not have the IPC bridge required to retrieve it.
 */
export const issueStudioExecutorLease = onCall(
  { region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
    const input = (request.data ?? {}) as { deviceId?: unknown; enrollmentSecret?: unknown };
    if (typeof input.deviceId !== 'string' || !DEVICE_ID.test(input.deviceId) ||
        typeof input.enrollmentSecret !== 'string' || !ENROLLMENT_SECRET.test(input.enrollmentSecret)) {
      throw new HttpsError('invalid-argument', 'Invalid Studio executor enrollment credential.');
    }

    const deviceRef = admin.firestore().doc(`users/${request.auth.uid}/studioExecutors/${input.deviceId}`);
    const secretHash = digest(input.enrollmentSecret);
    const leaseToken = randomBytes(32).toString('base64url');
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + LEASE_MS);

    await admin.firestore().runTransaction(async tx => {
      const existing = await tx.get(deviceRef);
      if (existing.exists && existing.get('secretHash') !== secretHash) {
        throw new HttpsError('permission-denied', 'This Studio executor is enrolled to a different keychain credential.');
      }
      tx.set(deviceRef, {
        deviceId: input.deviceId,
        secretHash,
        activeLeaseToken: leaseToken,
        leaseExpiresAt: expiresAt,
        createdAt: existing.exists ? existing.get('createdAt') : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return { deviceId: input.deviceId, leaseToken, expiresAt: expiresAt.toMillis() };
  });

export const publishStudioPresence = onCall({ region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  const input = (request.data ?? {}) as { deviceId?: unknown; leaseToken?: unknown; protocolVersion?: unknown; state?: Record<string, unknown> };
  await assertLease(request.auth.uid, input.deviceId, input.leaseToken);
  if (input.protocolVersion !== undefined && input.protocolVersion !== REMOTE_RELAY_PROTOCOL_VERSION) {
    throw new HttpsError('failed-precondition', 'This Studio uses an unsupported remote protocol version. Update indii Studio and try again.');
  }
  const state = input.state || {};
  const studioInstanceId = typeof state.studioInstanceId === 'string' ? state.studioInstanceId : '';
  if (!DEVICE_ID.test(studioInstanceId)) throw new HttpsError('invalid-argument', 'Invalid Studio instance.');

  // Phase 5 capability advertisement: presence is projected server-side from
  // the lease holder. Accept only the five known boolean keys, coerce to
  // boolean, and drop anything else so a Controller can never inflate its own
  // capabilities through the state payload.
  const CAPABILITY_KEYS = ['agent', 'computer', 'audio', 'daw', 'ui'] as const;
  const rawCaps = (state.capabilities && typeof state.capabilities === 'object' ? state.capabilities : {}) as Record<string, unknown>;
  const capabilities: Record<string, boolean> = {};
  for (const key of CAPABILITY_KEYS) {
    capabilities[key] = rawCaps[key] === true;
  }

  await admin.firestore().doc(`users/${request.auth.uid}/remote-relay/state`).set({
    currentModule: typeof state.currentModule === 'string' ? state.currentModule.slice(0, 80) : 'dashboard',
    isAgentProcessing: state.isAgentProcessing === true,
    activeSessionId: typeof state.activeSessionId === 'string' ? state.activeSessionId.slice(0, 128) : '',
    sleepMode: state.sleepMode === true,
    online: true,
    role: 'studio',
    studioInstanceId,
    executorDeviceId: input.deviceId,
    protocolVersion: REMOTE_RELAY_PROTOCOL_VERSION,
    listenerReady: true,
    capabilities,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const releaseStudioPresence = onCall({ region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  const input = (request.data ?? {}) as { deviceId?: unknown; leaseToken?: unknown; studioInstanceId?: unknown };
  await assertLease(request.auth.uid, input.deviceId, input.leaseToken);
  if (typeof input.studioInstanceId !== 'string') throw new HttpsError('invalid-argument', 'Invalid Studio instance.');
  const stateRef = admin.firestore().doc(`users/${request.auth.uid}/remote-relay/state`);
  await admin.firestore().runTransaction(async tx => {
    const state = await tx.get(stateRef);
    if (state.exists && state.get('studioInstanceId') === input.studioInstanceId && state.get('executorDeviceId') === input.deviceId) {
      tx.update(stateRef, { online: false, listenerReady: false, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  return { ok: true };
});

export const claimStudioCommand = onCall({ region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  const input = (request.data ?? {}) as { deviceId?: unknown; leaseToken?: unknown; commandId?: unknown; studioInstanceId?: unknown };
  await assertLease(request.auth.uid, input.deviceId, input.leaseToken);
  if (typeof input.commandId !== 'string' || typeof input.studioInstanceId !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid Studio command claim.');
  }
  const commandRef = admin.firestore().doc(`users/${request.auth.uid}/remote-relay-commands/${input.commandId}`);
  const claimed = await admin.firestore().runTransaction(async tx => {
    const command = await tx.get(commandRef);
    if (!command.exists || command.get('status') !== 'pending' || command.get('executionTarget') !== 'studio') return false;
    tx.update(commandRef, {
      status: 'processing',
      executorId: input.studioInstanceId,
      executorDeviceId: input.deviceId,
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  });
  return { claimed };
});

export const publishStudioResponse = onCall({ region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  const input = (request.data ?? {}) as { deviceId?: unknown; leaseToken?: unknown; commandId?: unknown; text?: unknown; agentId?: unknown; imageUrls?: unknown; isStreaming?: unknown; boardroomMessageId?: unknown };
  const { deviceId } = await assertLease(request.auth.uid, input.deviceId, input.leaseToken);
  if (typeof input.commandId !== 'string' || typeof input.text !== 'string' || input.text.length > 20_000) {
    throw new HttpsError('invalid-argument', 'Invalid Studio response.');
  }
  const commandRef = admin.firestore().doc(`users/${request.auth.uid}/remote-relay-commands/${input.commandId}`);
  const command = await commandRef.get();
  if (!command.exists || command.get('executionTarget') !== 'studio' || command.get('executorDeviceId') !== deviceId) {
    throw new HttpsError('permission-denied', 'This Studio does not own the command response.');
  }
  await admin.firestore().collection(`users/${request.auth.uid}/remote-relay-responses`).add({
    commandId: input.commandId,
    text: input.text,
    ...(typeof input.agentId === 'string' ? { agentId: input.agentId.slice(0, 100) } : {}),
    ...(Array.isArray(input.imageUrls) ? { imageUrls: input.imageUrls.filter(url => typeof url === 'string').slice(0, 20) } : {}),
    ...(typeof input.boardroomMessageId === 'string' ? { boardroomMessageId: input.boardroomMessageId.slice(0, 128) } : {}),
    isStreaming: input.isStreaming === true,
    isFinal: input.isStreaming !== true,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const completeStudioCommand = onCall({ region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  const input = (request.data ?? {}) as { deviceId?: unknown; leaseToken?: unknown; commandId?: unknown };
  const { deviceId } = await assertLease(request.auth.uid, input.deviceId, input.leaseToken);
  if (typeof input.commandId !== 'string') throw new HttpsError('invalid-argument', 'Invalid Studio completion.');
  const commandRef = admin.firestore().doc(`users/${request.auth.uid}/remote-relay-commands/${input.commandId}`);
  await admin.firestore().runTransaction(async tx => {
    const command = await tx.get(commandRef);
    if (!command.exists || command.get('executionTarget') !== 'studio' || command.get('executorDeviceId') !== deviceId) {
      throw new HttpsError('permission-denied', 'This Studio does not own the command completion.');
    }
    if (command.get('status') === 'processing') {
      tx.update(commandRef, { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  return { ok: true };
});
