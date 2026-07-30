export interface VerifiedMasterAudioForStitch {
    uri: string;
    storagePath: string;
    contentHash: string;
    generation: string;
    masterFingerprint: string;
    volume: number;
}

export interface MasterAudioStitchPlan {
    intermediateOutputUri: string;
    intermediateVideoUri: string;
    finalOutputUri: string;
    finalVideoUri: string;
    concatenateConfig: Record<string, unknown>;
    masterMixConfig: Record<string, unknown>;
}

export interface PrivateRenderOutputIdentity {
    policy: 'private-project-render.v1';
    ownerUid: string;
    projectId: string;
    jobId: string;
}

export interface PrivateRenderOutputUris {
    baseOutputUri: string;
    intermediateOutputUri: string;
    intermediateVideoUri: string;
    finalOutputUri: string;
    finalVideoUri: string;
}

const MASTER_PATH = /^masters\/([A-Za-z0-9_-]{1,128})\/([a-f0-9]{64})\/original\.(wav|flac)$/;

function requiredIdentifier(value: string, field: string): string {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
        throw new Error(`${field} is invalid.`);
    }
    return value;
}

export function derivePrivateRenderOutputUris(input: {
    bucketName: string;
    expectedOwnerUid: string;
    expectedJobId: string;
    identity: PrivateRenderOutputIdentity;
}): PrivateRenderOutputUris {
    const bucketName = input.bucketName.trim();
    if (!/^[A-Za-z0-9._-]{3,222}$/.test(bucketName)) {
        throw new Error('bucketName is invalid.');
    }
    const identity = input.identity;
    if (
        !identity
        || typeof identity !== 'object'
        || Array.isArray(identity)
        || Object.keys(identity).sort().join(',') !== 'jobId,ownerUid,policy,projectId'
        || identity.policy !== 'private-project-render.v1'
    ) {
        throw new Error('privateOutputIdentity is invalid.');
    }
    const expectedOwnerUid = requiredIdentifier(input.expectedOwnerUid, 'expectedOwnerUid');
    const expectedJobId = requiredIdentifier(input.expectedJobId, 'expectedJobId');
    const ownerUid = requiredIdentifier(identity.ownerUid, 'privateOutputIdentity.ownerUid');
    const projectId = requiredIdentifier(identity.projectId, 'privateOutputIdentity.projectId');
    const jobId = requiredIdentifier(identity.jobId, 'privateOutputIdentity.jobId');
    if (ownerUid !== expectedOwnerUid) {
        throw new Error('privateOutputIdentity owner does not match the authenticated render owner.');
    }
    if (jobId !== expectedJobId) {
        throw new Error('privateOutputIdentity job does not match the server render job.');
    }

    const baseOutputUri = `gs://${bucketName}/private-renders/${ownerUid}/${projectId}/${jobId}`;
    const intermediateOutputUri = `${baseOutputUri}/video-pass/`;
    const finalOutputUri = `${baseOutputUri}/master-pass/`;
    return {
        baseOutputUri,
        intermediateOutputUri,
        intermediateVideoUri: `${intermediateOutputUri}concatenated.mp4`,
        finalOutputUri,
        finalVideoUri: `${finalOutputUri}final_output.mp4`,
    };
}

function masterGainDb(volume: number): number {
    if (!Number.isFinite(volume) || volume <= 0 || volume > 1) {
        throw new Error('masterAudio.volume must be greater than zero and at most one.');
    }
    return Number(Math.max(-60, 20 * Math.log10(volume)).toFixed(4));
}

function durationOffset(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 7_200) {
        throw new Error('timelineDurationSeconds must be greater than zero and at most two hours.');
    }
    return `${Number(seconds.toFixed(6))}s`;
}

function validateMaster(
    bucketName: string,
    ownerUid: string,
    master: VerifiedMasterAudioForStitch,
): void {
    const match = master.storagePath.match(MASTER_PATH);
    if (!match || match[1] !== ownerUid) {
        throw new Error('masterAudio.storagePath is not the authenticated owner canonical master.');
    }
    if (match[2] !== master.contentHash || !/^[a-f0-9]{64}$/.test(master.contentHash)) {
        throw new Error('masterAudio.contentHash does not match the canonical master path.');
    }
    if (!/^[1-9][0-9]{0,29}$/.test(master.generation)) {
        throw new Error('masterAudio.generation is invalid.');
    }
    if (!master.masterFingerprint.trim() || master.masterFingerprint.length > 256) {
        throw new Error('masterAudio.masterFingerprint is invalid.');
    }
    const expectedUri = `gs://${bucketName}/${master.storagePath}`;
    if (master.uri !== expectedUri) {
        throw new Error('masterAudio URI does not match the verified project-bucket master.');
    }
    masterGainDb(master.volume);
}

/**
 * Builds the two Transcoder jobs necessary for a real master-audio render.
 *
 * A concatenation atom cannot trim a sequence of short video sources and one
 * long audio master independently. We therefore concatenate video first, then
 * map the canonical master as an explicit stereo input in a second job.
 */
export function buildMasterAudioStitchPlan(input: {
    bucketName: string;
    jobId: string;
    userId: string;
    resolution: { width: number; height: number };
    /** Final visual timeline duration; the canonical master is trimmed to it. */
    timelineDurationSeconds: number;
    segmentUris: string[];
    masterAudio: VerifiedMasterAudioForStitch;
    privateOutputIdentity?: PrivateRenderOutputIdentity;
}): MasterAudioStitchPlan {
    const bucketName = input.bucketName.trim();
    if (!/^[A-Za-z0-9._-]{3,222}$/.test(bucketName)) {
        throw new Error('bucketName is invalid.');
    }
    const jobId = requiredIdentifier(input.jobId, 'jobId');
    const userId = requiredIdentifier(input.userId, 'userId');
    if (!Number.isInteger(input.resolution.width) || !Number.isInteger(input.resolution.height)
        || input.resolution.width < 1 || input.resolution.height < 1) {
        throw new Error('resolution is invalid.');
    }
    if (!Array.isArray(input.segmentUris) || input.segmentUris.length === 0) {
        throw new Error('At least one video segment is required.');
    }
    const segmentUris = input.segmentUris.map((uri, index) => requireOwnedCanonicalVideoSource(
        userId,
        bucketName,
        uri,
        `segmentUris[${index}]`,
    ));
    validateMaster(bucketName, userId, input.masterAudio);

    const privateUris = input.privateOutputIdentity
        ? derivePrivateRenderOutputUris({
            bucketName,
            expectedOwnerUid: userId,
            expectedJobId: jobId,
            identity: input.privateOutputIdentity,
        })
        : undefined;
    const baseOutputUri = privateUris?.baseOutputUri ?? `gs://${bucketName}/videos/${userId}/${jobId}_output`;
    const intermediateOutputUri = privateUris?.intermediateOutputUri ?? `${baseOutputUri}/video-pass/`;
    const intermediateVideoUri = privateUris?.intermediateVideoUri ?? `${intermediateOutputUri}concatenated.mp4`;
    const finalOutputUri = privateUris?.finalOutputUri ?? `${baseOutputUri}/master-pass/`;
    const finalVideoUri = privateUris?.finalVideoUri ?? `${finalOutputUri}final_output.mp4`;
    const videoStream = {
        h264: {
            heightPixels: input.resolution.height,
            widthPixels: input.resolution.width,
            bitrateBps: 5_000_000,
            frameRate: 30,
        },
    };
    const masterAtomKey = 'master-audio-atom';
    const gainDb = masterGainDb(input.masterAudio.volume);
    const timelineEndTimeOffset = durationOffset(input.timelineDurationSeconds);

    return {
        intermediateOutputUri,
        intermediateVideoUri,
        finalOutputUri,
        finalVideoUri,
        concatenateConfig: {
            inputs: segmentUris.map((uri, index) => ({ key: `scene-${index}`, uri })),
            editList: segmentUris.map((_uri, index) => ({ key: `scene-atom-${index}`, inputs: [`scene-${index}`] })),
            elementaryStreams: [{ key: 'video-stream', videoStream }],
            muxStreams: [{
                key: 'concatenated-video',
                fileName: 'concatenated.mp4',
                container: 'mp4',
                elementaryStreams: ['video-stream'],
            }],
        },
        masterMixConfig: {
            inputs: [
                { key: 'concatenated-video', uri: intermediateVideoUri },
                { key: 'canonical-master', uri: input.masterAudio.uri },
            ],
            editList: [{
                key: masterAtomKey,
                inputs: ['concatenated-video', 'canonical-master'],
                startTimeOffset: '0s',
                endTimeOffset: timelineEndTimeOffset,
            }],
            elementaryStreams: [
                { key: 'video-stream', videoStream },
                {
                    key: 'master-audio',
                    audioStream: {
                        codec: 'aac',
                        bitrateBps: 192_000,
                        channelCount: 2,
                        channelLayout: ['fl', 'fr'],
                        sampleRateHertz: 48_000,
                        mapping: [
                            { atomKey: masterAtomKey, inputKey: 'canonical-master', inputTrack: 0, inputChannel: 0, outputChannel: 0, gainDb },
                            { atomKey: masterAtomKey, inputKey: 'canonical-master', inputTrack: 0, inputChannel: 1, outputChannel: 1, gainDb },
                        ],
                    },
                },
            ],
            muxStreams: [{
                key: 'final-output',
                fileName: 'final_output.mp4',
                container: 'mp4',
                elementaryStreams: ['video-stream', 'master-audio'],
            }],
        },
    };
}
import { requireOwnedCanonicalVideoSource } from './renderMasterContract';
