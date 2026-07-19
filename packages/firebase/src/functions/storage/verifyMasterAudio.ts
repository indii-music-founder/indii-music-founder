import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { validateAppCheckV2 } from '../../middleware/appCheck';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ORIGINAL_AUDIO_NAME_PATTERN = /^original\.[a-z0-9]{2,8}$/;
const MAX_MASTER_BYTES = 500 * 1024 * 1024;

interface MasterFileLike {
    getMetadata(): Promise<Array<{
        contentType?: string;
        size?: string | number;
        generation?: string | number;
        metadata?: Record<string, string>;
    }>>;
    createReadStream(): NodeJS.ReadableStream;
}

interface MasterBucketLike {
    file(path: string): MasterFileLike;
}

interface VerificationFirestoreLike {
    collection(name: string): {
        doc(id: string): {
            set(data: Record<string, unknown>, options?: { merge: boolean }): Promise<unknown>;
        };
    };
}

interface VerifyMasterAudioInput {
    storagePath: string;
    expectedSha256: string;
    masterFingerprint: string;
}

export interface VerifyMasterAudioResponse {
    verified: true;
    contentHash: string;
    generation: string;
    storagePath: string;
}

function requiredString(value: unknown, label: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
        throw new HttpsError('invalid-argument', `${label} is invalid.`);
    }
    return value.trim();
}

function verificationId(userId: string, storagePath: string): string {
    return `master_${createHash('sha256').update(`${userId}\0${storagePath}`).digest('hex').slice(0, 48)}`;
}

async function streamSha256(stream: NodeJS.ReadableStream): Promise<string> {
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
        stream.on('data', chunk => hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.once('error', reject);
        stream.once('end', resolve);
    });
    return hash.digest('hex');
}

export async function verifyMasterAudioObject(
    userId: string,
    rawInput: VerifyMasterAudioInput,
    bucket: MasterBucketLike = admin.storage().bucket() as unknown as MasterBucketLike,
    firestore: VerificationFirestoreLike = admin.firestore() as unknown as VerificationFirestoreLike
): Promise<VerifyMasterAudioResponse> {
    const storagePath = requiredString(rawInput?.storagePath, 'storagePath', 1_024);
    const expectedSha256 = requiredString(rawInput?.expectedSha256, 'expectedSha256', 64).toLowerCase();
    const masterFingerprint = requiredString(rawInput?.masterFingerprint, 'masterFingerprint', 256);
    if (!SHA256_PATTERN.test(expectedSha256)) {
        throw new HttpsError('invalid-argument', 'expectedSha256 must be a lowercase SHA-256 digest.');
    }

    const pathParts = storagePath.split('/');
    if (
        pathParts.length !== 4 ||
        pathParts[0] !== 'masters' ||
        pathParts[1] !== userId ||
        pathParts[2] !== expectedSha256 ||
        !ORIGINAL_AUDIO_NAME_PATTERN.test(pathParts[3] ?? '')
    ) {
        throw new HttpsError('permission-denied', 'The master storage path does not belong to this owner and digest.');
    }

    const proofRef = firestore.collection('master_verifications').doc(verificationId(userId, storagePath));
    const file = bucket.file(storagePath);
    const [metadata] = await file.getMetadata();
    const customMetadata = metadata.metadata ?? {};
    const sizeBytes = Number(metadata.size);
    const generation = String(metadata.generation ?? '');
    const metadataIssues = [
        !metadata.contentType?.startsWith('audio/') ? 'stored content type is not audio' : '',
        !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_MASTER_BYTES ? 'stored size is invalid' : '',
        customMetadata.ownerId !== userId ? 'owner metadata does not match' : '',
        customMetadata.contentHash !== expectedSha256 ? 'content-hash metadata does not match' : '',
        customMetadata.immutable !== 'true' ? 'immutable metadata is missing' : '',
        customMetadata.masterFingerprint !== masterFingerprint ? 'master fingerprint metadata does not match' : '',
        !/^[1-9][0-9]*$/.test(generation) ? 'stored generation is invalid' : '',
    ].filter(Boolean);

    if (metadataIssues.length > 0) {
        await proofRef.set({
            userId,
            storagePath,
            expectedSha256,
            generation,
            status: 'rejected',
            rejectionReason: metadataIssues.join('; '),
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw new HttpsError('failed-precondition', `Master verification failed: ${metadataIssues.join('; ')}.`);
    }

    const observedSha256 = await streamSha256(file.createReadStream());
    const verified = observedSha256 === expectedSha256;
    await proofRef.set({
        userId,
        storagePath,
        expectedSha256,
        observedSha256,
        masterFingerprint,
        generation,
        sizeBytes,
        contentType: metadata.contentType,
        status: verified ? 'verified' : 'rejected',
        ...(verified ? {} : { rejectionReason: 'Stored bytes do not match the content-addressed path.' }),
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!verified) {
        throw new HttpsError('data-loss', 'Stored master bytes do not match the claimed SHA-256 digest.');
    }
    return {
        verified: true,
        contentHash: expectedSha256,
        generation,
        storagePath,
    };
}

export const verifyMasterAudio = onCall(
    { enforceAppCheck: false, timeoutSeconds: 540, memory: '512MiB' },
    async request => {
        validateAppCheckV2(request);
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to verify a master audio object.');
        return verifyMasterAudioObject(request.auth.uid, request.data as VerifyMasterAudioInput);
    }
);
