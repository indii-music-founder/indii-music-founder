import type { VerifiedMasterAudioForStitch } from './stitchMasterAudio';

export interface CanonicalRenderMaster {
    storagePath: string;
    contentHash: string;
    generation: string;
    masterFingerprint: string;
    volume: number;
}

/** Exact async-worker payload; both callable and stitcher share this type. */
export type VerifiedRenderMaster = VerifiedMasterAudioForStitch;

export interface MasterVerificationResult {
    verified: true;
    contentHash: string;
    generation: string;
    storagePath: string;
}

export class CanonicalRenderMasterError extends Error {
    constructor(
        public readonly code: 'invalid-argument' | 'permission-denied' | 'failed-precondition',
        message: string,
    ) {
        super(message);
        this.name = 'CanonicalRenderMasterError';
    }
}

const MASTER_PATH = /^masters\/([A-Za-z0-9_-]{1,128})\/([a-f0-9]{64})\/original\.(wav|flac)$/;
const VIDEO_EXTENSION = /\.(mp4|mov|webm)$/i;

function record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function requiredString(value: unknown, field: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
        throw new CanonicalRenderMasterError('invalid-argument', `${field} is invalid.`);
    }
    return value.trim();
}

function boundedVolume(value: unknown): number {
    if (value === undefined) return 1;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
        throw new CanonicalRenderMasterError('invalid-argument', 'canonicalMaster.volume must be greater than zero and at most one.');
    }
    return value;
}

function allowedVideoPrefixes(ownerUid: string): string[] {
    return [
        `creative/${ownerUid}/`,
        `videos/${ownerUid}/`,
        `users/${ownerUid}/assets/`,
    ];
}

/**
 * Resolves one visual source at both trust boundaries. Keeping this in the
 * callable contract avoids the stitch worker slowly drifting into a broader
 * URI policy than the user-facing admission check.
 */
export function requireOwnedCanonicalVideoSource(
    ownerUid: string,
    bucketName: string,
    source: unknown,
    field = 'Video source',
): string {
    if (!/^[A-Za-z0-9._-]{3,222}$/.test(bucketName)) {
        throw new CanonicalRenderMasterError('failed-precondition', 'Configured Storage bucket is invalid.');
    }
    if (typeof source !== 'string' || /[\r\n]/.test(source)) {
        throw new CanonicalRenderMasterError('failed-precondition', `${field} must carry a canonical project-bucket source URI.`);
    }
    const bucketPrefix = `gs://${bucketName}/`;
    if (!source.startsWith(bucketPrefix)) {
        throw new CanonicalRenderMasterError('failed-precondition', `${field} must carry a canonical project-bucket source URI.`);
    }
    const objectPath = source.slice(bucketPrefix.length);
    if (
        !objectPath ||
        objectPath.includes('..') ||
        !VIDEO_EXTENSION.test(objectPath) ||
        !allowedVideoPrefixes(ownerUid).some(prefix => objectPath.startsWith(prefix))
    ) {
        throw new CanonicalRenderMasterError('permission-denied', `${field} is not an owner-scoped project video source.`);
    }
    return source;
}

/**
 * Extract durable visual source identities. Browser preview URLs are never
 * Transcoder authority; only project-bucket media under the owner's namespace
 * can reach an asynchronous render worker.
 */
export function parseProjectCanonicalVideoSegments(
    ownerUid: string,
    bucketName: string,
    clips: unknown[],
): string[] {
    const videoClips = clips.filter(clip => record(clip)?.type === 'video');
    if (videoClips.length === 0) {
        throw new CanonicalRenderMasterError('failed-precondition', 'No video clips found in project to render.');
    }
    return videoClips
        .sort((left, right) => Number(record(left)?.startFrame) - Number(record(right)?.startFrame))
        .map((clip, index) => requireOwnedCanonicalVideoSource(
            ownerUid,
            bucketName,
            record(clip)?.canonicalSourceUri,
            `Video clip ${index + 1}`,
        ));
}

/**
 * Reads the sole audio lane accepted by a cloud render. A browser URL is never
 * an audio authority: the server receives only immutable master identity.
 */
export function parseProjectCanonicalMaster(
    ownerUid: string,
    clips: unknown[],
): CanonicalRenderMaster | undefined {
    const audioClips = clips.filter(clip => record(clip)?.type === 'audio');
    if (audioClips.length === 0) return undefined;
    if (audioClips.length !== 1) {
        throw new CanonicalRenderMasterError('failed-precondition', 'A render can contain at most one canonical master audio clip.');
    }

    const audioClip = record(audioClips[0]);
    if (audioClip?.startFrame !== undefined && audioClip.startFrame !== 0) {
        throw new CanonicalRenderMasterError(
            'failed-precondition',
            'Canonical master audio must start at frame zero for a cloud render.',
        );
    }
    if (audioClip?.durationInFrames !== undefined && (
        !Number.isInteger(audioClip.durationInFrames) || Number(audioClip.durationInFrames) <= 0
    )) {
        throw new CanonicalRenderMasterError('invalid-argument', 'Canonical master audio duration is invalid.');
    }
    const rawMaster = record(audioClip?.canonicalMaster);
    if (!rawMaster) {
        throw new CanonicalRenderMasterError(
            'failed-precondition',
            'Audio render clips must reference a verified canonical master; raw URLs are not accepted.',
        );
    }

    const storagePath = requiredString(rawMaster.storagePath, 'canonicalMaster.storagePath', 1_024);
    const contentHash = requiredString(rawMaster.contentHash, 'canonicalMaster.contentHash', 64).toLowerCase();
    const generation = requiredString(rawMaster.generation, 'canonicalMaster.generation', 30);
    const masterFingerprint = requiredString(rawMaster.masterFingerprint, 'canonicalMaster.masterFingerprint', 256);
    const match = storagePath.match(MASTER_PATH);
    if (!match) {
        throw new CanonicalRenderMasterError('invalid-argument', 'canonicalMaster.storagePath must identify a WAV or FLAC master.');
    }
    if (match[1] !== ownerUid) {
        throw new CanonicalRenderMasterError('permission-denied', 'Canonical master does not belong to the authenticated owner.');
    }
    if (match[2] !== contentHash) {
        throw new CanonicalRenderMasterError('invalid-argument', 'canonicalMaster.contentHash does not match the canonical path.');
    }
    if (!/^[1-9][0-9]{0,29}$/.test(generation)) {
        throw new CanonicalRenderMasterError('invalid-argument', 'canonicalMaster.generation is invalid.');
    }

    return {
        storagePath,
        contentHash,
        generation,
        masterFingerprint,
        volume: boundedVolume(rawMaster.volume),
    };
}

/** Verify bytes and generation before an asynchronous worker receives the master. */
export async function resolveVerifiedRenderMaster(
    ownerUid: string,
    master: CanonicalRenderMaster,
    dependencies: {
        bucketName: string;
        verifyMaster: (owner: string, input: {
            storagePath: string;
            expectedSha256: string;
            masterFingerprint: string;
        }) => Promise<MasterVerificationResult>;
    },
): Promise<VerifiedRenderMaster> {
    if (!/^[A-Za-z0-9._-]{3,222}$/.test(dependencies.bucketName)) {
        throw new CanonicalRenderMasterError('failed-precondition', 'Configured Storage bucket is invalid.');
    }

    let verification: MasterVerificationResult;
    try {
        verification = await dependencies.verifyMaster(ownerUid, {
            storagePath: master.storagePath,
            expectedSha256: master.contentHash,
            masterFingerprint: master.masterFingerprint,
        });
    } catch {
        throw new CanonicalRenderMasterError('failed-precondition', 'Canonical master verification failed before rendering.');
    }

    if (
        verification.storagePath !== master.storagePath ||
        verification.contentHash !== master.contentHash ||
        verification.generation !== master.generation
    ) {
        throw new CanonicalRenderMasterError(
            'failed-precondition',
            'Canonical master generation changed before rendering. Re-select the verified master and retry.',
        );
    }

    return {
        ...master,
        uri: `gs://${dependencies.bucketName}/${master.storagePath}`,
    };
}
