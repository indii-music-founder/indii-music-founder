import { describe, expect, it } from 'vitest';

import { buildMasterAudioStitchPlan, derivePrivateRenderOutputUris } from './stitchMasterAudio';

const masterAudio = {
    uri: 'gs://indii-music-founder.firebasestorage.app/masters/user-1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.flac',
    storagePath: 'masters/user-1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/original.flac',
    contentHash: 'a'.repeat(64),
    generation: '123456789',
    masterFingerprint: 'SONIC-master-1',
    volume: 0.5,
};

describe('buildMasterAudioStitchPlan', () => {
    it('preserves the legacy output contract byte-for-byte when no private identity is present', () => {
        const plan = buildMasterAudioStitchPlan({
            bucketName: 'indii-music-founder.firebasestorage.app',
            jobId: 'render-1',
            userId: 'user-1',
            resolution: { width: 1920, height: 1080 },
            timelineDurationSeconds: 12,
            segmentUris: [
                'gs://indii-music-founder.firebasestorage.app/creative/user-1/scene-1.mp4',
                'gs://indii-music-founder.firebasestorage.app/creative/user-1/scene-2.mp4',
            ],
            masterAudio,
        });

        expect(plan.intermediateVideoUri).toBe(
            'gs://indii-music-founder.firebasestorage.app/videos/user-1/render-1_output/video-pass/concatenated.mp4',
        );
        expect(plan.finalVideoUri).toBe(
            'gs://indii-music-founder.firebasestorage.app/videos/user-1/render-1_output/master-pass/final_output.mp4',
        );
        expect(plan.concatenateConfig).toMatchObject({
            inputs: [
                { key: 'scene-0', uri: 'gs://indii-music-founder.firebasestorage.app/creative/user-1/scene-1.mp4' },
                { key: 'scene-1', uri: 'gs://indii-music-founder.firebasestorage.app/creative/user-1/scene-2.mp4' },
            ],
            editList: [
                { key: 'scene-atom-0', inputs: ['scene-0'] },
                { key: 'scene-atom-1', inputs: ['scene-1'] },
            ],
            muxStreams: [{ key: 'concatenated-video', fileName: 'concatenated.mp4', container: 'mp4', elementaryStreams: ['video-stream'] }],
        });
        expect(plan.masterMixConfig).toMatchObject({
            inputs: [
                { key: 'concatenated-video', uri: plan.intermediateVideoUri },
                { key: 'canonical-master', uri: masterAudio.uri },
            ],
            editList: [{
                key: 'master-audio-atom',
                inputs: ['concatenated-video', 'canonical-master'],
                startTimeOffset: '0s',
                endTimeOffset: '12s',
            }],
            muxStreams: [{ key: 'final-output', fileName: 'final_output.mp4', container: 'mp4', elementaryStreams: ['video-stream', 'master-audio'] }],
        });
        const elementaryStreams = plan.masterMixConfig.elementaryStreams;
        expect(Array.isArray(elementaryStreams)).toBe(true);
        if (!Array.isArray(elementaryStreams)) throw new Error('Expected Transcoder elementary streams.');
        expect(elementaryStreams[1]).toEqual({
            key: 'master-audio',
            audioStream: {
                codec: 'aac',
                bitrateBps: 192_000,
                channelCount: 2,
                channelLayout: ['fl', 'fr'],
                sampleRateHertz: 48_000,
                mapping: [
                    { atomKey: 'master-audio-atom', inputKey: 'canonical-master', inputTrack: 0, inputChannel: 0, outputChannel: 0, gainDb: -6.0206 },
                    { atomKey: 'master-audio-atom', inputKey: 'canonical-master', inputTrack: 0, inputChannel: 1, outputChannel: 1, gainDb: -6.0206 },
                ],
            },
        });
    });

    it('derives the exact private project render path without accepting a caller path', () => {
        const identity = {
            policy: 'private-project-render.v1' as const,
            ownerUid: 'user-1',
            projectId: 'project-1',
            jobId: 'render-1',
        };
        expect(derivePrivateRenderOutputUris({
            bucketName: 'indii-music-founder.firebasestorage.app',
            expectedOwnerUid: 'user-1',
            expectedJobId: 'render-1',
            identity,
        })).toEqual({
            baseOutputUri: 'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1',
            intermediateOutputUri: 'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1/video-pass/',
            intermediateVideoUri: 'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1/video-pass/concatenated.mp4',
            finalOutputUri: 'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1/master-pass/',
            finalVideoUri: 'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1/master-pass/final_output.mp4',
        });

        const plan = buildMasterAudioStitchPlan({
            bucketName: 'indii-music-founder.firebasestorage.app',
            jobId: 'render-1',
            userId: 'user-1',
            resolution: { width: 1920, height: 1080 },
            timelineDurationSeconds: 12,
            segmentUris: ['gs://indii-music-founder.firebasestorage.app/creative/user-1/scene.mp4'],
            masterAudio,
            privateOutputIdentity: identity,
        });
        expect(plan.finalVideoUri).toBe(
            'gs://indii-music-founder.firebasestorage.app/private-renders/user-1/project-1/render-1/master-pass/final_output.mp4',
        );
    });

    it('rejects malformed, traversal, cross-owner, mismatched-job, and caller-selected private bases', () => {
        const base = {
            bucketName: 'indii-music-founder.firebasestorage.app',
            expectedOwnerUid: 'user-1',
            expectedJobId: 'render-1',
        };
        expect(() => derivePrivateRenderOutputUris({
            ...base,
            identity: {
                policy: 'private-project-render.v1',
                ownerUid: 'other-user',
                projectId: 'project-1',
                jobId: 'render-1',
            },
        })).toThrow('owner does not match');
        expect(() => derivePrivateRenderOutputUris({
            ...base,
            identity: {
                policy: 'private-project-render.v1',
                ownerUid: 'user-1',
                projectId: '../project-1',
                jobId: 'render-1',
            },
        })).toThrow('projectId is invalid');
        expect(() => derivePrivateRenderOutputUris({
            ...base,
            identity: {
                policy: 'private-project-render.v1',
                ownerUid: 'user-1',
                projectId: 'project-1',
                jobId: 'other-render',
            },
        })).toThrow('job does not match');
        expect(() => derivePrivateRenderOutputUris({
            ...base,
            identity: {
                policy: 'private-project-render.v1',
                ownerUid: 'user-1',
                projectId: 'project-1',
                jobId: 'render-1',
                baseOutputUri: 'gs://attacker-bucket/public',
            } as never,
        })).toThrow('privateOutputIdentity is invalid');
    });

    it('rejects an arbitrary, cross-owner, or malformed master before the worker can submit a Transcoder job', () => {
        expect(() => buildMasterAudioStitchPlan({
            bucketName: 'indii-music-founder.firebasestorage.app',
            jobId: 'render-1',
            userId: 'user-1',
            resolution: { width: 1920, height: 1080 },
            timelineDurationSeconds: 12,
            segmentUris: ['https://attacker.example/scene.mp4'],
            masterAudio,
        })).toThrow('canonical project-bucket source URI');

        expect(() => buildMasterAudioStitchPlan({
            bucketName: 'indii-music-founder.firebasestorage.app',
            jobId: 'render-1',
            userId: 'user-1',
            resolution: { width: 1920, height: 1080 },
            timelineDurationSeconds: 12,
            segmentUris: ['gs://indii-music-founder.firebasestorage.app/creative/other-user/scene.mp4'],
            masterAudio,
        })).toThrow('owner-scoped project video source');

        expect(() => buildMasterAudioStitchPlan({
            bucketName: 'indii-music-founder.firebasestorage.app',
            jobId: 'render-1',
            userId: 'user-1',
            resolution: { width: 1920, height: 1080 },
            timelineDurationSeconds: 12,
            segmentUris: ['gs://indii-music-founder.firebasestorage.app/creative/user-1/scene.mp4'],
            masterAudio: { ...masterAudio, contentHash: 'not-a-hash' },
        })).toThrow('contentHash');
    });
});
