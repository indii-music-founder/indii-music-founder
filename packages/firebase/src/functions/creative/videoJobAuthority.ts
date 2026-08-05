import { createHash } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';

export const GATEWAY_VIDEO_WORKER_VERSION = 'gateway-video-v3';

export interface VerifiedVideoInput {
  role: string;
  originalUri: string;
  stagedUri: string;
  sourceGeneration: string;
  stagedGeneration: string;
  sizeBytes: number;
  mimeType: string;
  sourceHash?: string;
}

export interface VideoInputRequest {
  role: string;
  uri: string;
  kind: 'image' | 'video' | 'mask';
}

interface StorageObjectEvidence {
  generation: string;
  sizeBytes: number;
  mimeType: string;
  prefix: Buffer;
  contentHash?: string;
}

export interface VideoInputStorage {
  bucketName: string;
  inspectExact(path: string): Promise<StorageObjectEvidence>;
  copyExact(sourcePath: string, sourceGeneration: string, destinationPath: string): Promise<{ generation: string }>;
  deleteExact(path: string, generation: string): Promise<void>;
}

function parseGsUri(uri: string): { bucket: string; path: string } {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) throw new HttpsError('invalid-argument', 'Video input must be a gs:// URI.');
  return { bucket: match[1]!, path: match[2]! };
}

function isOwnerPath(ownerUid: string, path: string): boolean {
  return [
    `creative/${ownerUid}/`,
    `generated/${ownerUid}/`,
    `videos/${ownerUid}/`,
    `users/${ownerUid}/vault/`,
  ].some(prefix => path.startsWith(prefix));
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  throw new HttpsError('invalid-argument', `Unsupported video input MIME type: ${mimeType}`);
}

function hasExpectedSignature(mimeType: string, prefix: Buffer): boolean {
  if (mimeType === 'image/png') return prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/jpeg') return prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff;
  if (mimeType === 'image/webp') return prefix.subarray(0, 4).toString('ascii') === 'RIFF'
    && prefix.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    return prefix.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mimeType === 'video/webm') return prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

function validateEvidence(kind: VideoInputRequest['kind'], evidence: StorageObjectEvidence): void {
  const allowed = kind === 'image'
    ? ['image/png', 'image/jpeg', 'image/webp']
    : kind === 'video'
      ? ['video/mp4', 'video/webm', 'video/quicktime']
      : ['image/png', 'video/mp4', 'video/webm'];
  if (!allowed.includes(evidence.mimeType)) {
    throw new HttpsError('invalid-argument', `${kind} input uses unsupported MIME type ${evidence.mimeType}.`);
  }
  const maximumBytes = kind === 'image' ? 20 * 1024 * 1024 : 500 * 1024 * 1024;
  if (!Number.isSafeInteger(evidence.sizeBytes) || evidence.sizeBytes <= 0 || evidence.sizeBytes > maximumBytes) {
    throw new HttpsError('resource-exhausted', `${kind} input exceeds its byte limit.`);
  }
  if (!evidence.generation) throw new HttpsError('failed-precondition', 'Video input generation is unavailable.');
  if (!hasExpectedSignature(evidence.mimeType, evidence.prefix)) {
    throw new HttpsError('invalid-argument', `Video input bytes do not match ${evidence.mimeType}.`);
  }
}

export async function authorizeAndStageVideoInputs(
  ownerUid: string,
  jobId: string,
  inputs: VideoInputRequest[],
  storage: VideoInputStorage,
): Promise<VerifiedVideoInput[]> {
  const unique = new Map<string, VideoInputRequest>();
  for (const input of inputs) {
    const key = `${input.kind}\0${input.uri}`;
    if (!unique.has(key)) unique.set(key, input);
  }

  const verified: VerifiedVideoInput[] = [];
  try {
    let index = 0;
    for (const input of unique.values()) {
      const { bucket, path } = parseGsUri(input.uri);
      if (bucket !== storage.bucketName) {
        throw new HttpsError('permission-denied', 'Video input must live in the configured project bucket.');
      }
      if (!isOwnerPath(ownerUid, path)) {
        throw new HttpsError('permission-denied', 'Video input is not scoped to the authenticated owner.');
      }
      const evidence = await storage.inspectExact(path);
      validateEvidence(input.kind, evidence);
      const stableName = createHash('sha256')
        .update(`${input.kind}\0${input.uri}\0${evidence.generation}`)
        .digest('hex')
        .slice(0, 32);
      const destinationPath = `generated/${ownerUid}/video-inputs/${jobId}/${index}-${stableName}.${extensionForMime(evidence.mimeType)}`;
      const staged = await storage.copyExact(path, evidence.generation, destinationPath);
      verified.push({
        role: input.role,
        originalUri: input.uri,
        stagedUri: `gs://${storage.bucketName}/${destinationPath}`,
        sourceGeneration: evidence.generation,
        stagedGeneration: staged.generation,
        sizeBytes: evidence.sizeBytes,
        mimeType: evidence.mimeType,
        ...(evidence.contentHash ? { sourceHash: evidence.contentHash } : {}),
      });
      index += 1;
    }
  } catch (error) {
    await Promise.allSettled(verified.map(input => {
      const { path } = parseGsUri(input.stagedUri);
      return storage.deleteExact(path, input.stagedGeneration);
    }));
    throw error;
  }
  return verified;
}

export function adminVideoInputStorage(storage: Storage): VideoInputStorage {
  const bucket = storage.bucket();
  return {
    bucketName: bucket.name,
    async inspectExact(path) {
      const file = bucket.file(path);
      const [metadata] = await file.getMetadata();
      const generation = String(metadata.generation ?? '');
      const sizeBytes = Number(metadata.size);
      const mimeType = String(metadata.contentType ?? '');
      const pinned = bucket.file(path, { generation });
      const [prefix] = await pinned.download({ start: 0, end: 15 });
      const customMetadata = metadata.metadata as Record<string, string> | undefined;
      return {
        generation,
        sizeBytes,
        mimeType,
        prefix,
        ...(customMetadata?.contentHash ? { contentHash: customMetadata.contentHash } : {}),
      };
    },
    async copyExact(sourcePath, sourceGeneration, destinationPath) {
      const source = bucket.file(sourcePath, { generation: sourceGeneration });
      const destination = bucket.file(destinationPath);
      await source.copy(destination, {
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      const [metadata] = await destination.getMetadata();
      const generation = String(metadata.generation ?? '');
      if (!generation) throw new HttpsError('failed-precondition', 'Staged video input generation is unavailable.');
      return { generation };
    },
    async deleteExact(path, generation) {
      await bucket.file(path, { generation }).delete({ ignoreNotFound: true });
    },
  };
}

export async function createClaimedVideoJob(
  db: Firestore,
  input: {
    ownerUid: string;
    reservationId: string;
    jobId: string;
    expectedCost: number;
    jobRecord: Record<string, unknown>;
  },
): Promise<void> {
  const jobRef = db.collection('videoJobs').doc(input.jobId);
  await db.runTransaction(async transaction => {
    const reservationRef = db.collection('costLedger').doc(input.reservationId);
    const [reservation, existingJob] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(jobRef),
    ]);
    if (!reservation.exists) throw new HttpsError('failed-precondition', 'Cost reservation is missing.');
    if (existingJob.exists) throw new HttpsError('already-exists', 'Video job already exists.');
    const data = reservation.data() ?? {};
    if (data.userId !== input.ownerUid) throw new HttpsError('permission-denied', 'Cost reservation owner mismatch.');
    if (data.type !== 'video') throw new HttpsError('failed-precondition', 'Cost reservation type mismatch.');
    if (data.status !== 'APPROVED') throw new HttpsError('failed-precondition', 'Cost reservation is already claimed or finalized.');
    const estimatedCost = Number(data.estimatedCost);
    if (!Number.isFinite(estimatedCost) || Math.abs(estimatedCost - input.expectedCost) > 0.01) {
      throw new HttpsError('failed-precondition', 'Cost reservation estimate does not match the video job.');
    }
    transaction.update(reservationRef, {
      status: 'CLAIMED',
      claimedJobId: input.jobId,
      claimedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(jobRef, input.jobRecord as FirebaseFirestore.WithFieldValue<FirebaseFirestore.DocumentData>);
  });
}

export async function claimQueuedGatewayVideoJob(
  db: Firestore,
  jobId: string,
): Promise<Record<string, unknown> | null> {
  const jobRef = db.collection('videoJobs').doc(jobId);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists) return null;
    const data = snapshot.data() ?? {};
    if (
      data.workerVersion !== GATEWAY_VIDEO_WORKER_VERSION
      || data.type !== 'video'
      || data.status !== 'queued'
    ) {
      return null;
    }
    transaction.update(jobRef, {
      status: 'processing',
      workerClaimedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ...data, status: 'processing' };
  });
}
