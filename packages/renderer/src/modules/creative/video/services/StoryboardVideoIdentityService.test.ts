import { describe, expect, it } from 'vitest';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { VideoRenderReceipt } from '@/services/video/RenderService';
import type { StoryboardProject } from '../schemas/storyboard';
import { StoryboardVideoIdentityService } from './StoryboardVideoIdentityService';

const recordingEntityId = 'recording:internal-1';

function fixtures(): {
    metadata: ExtendedGoldenMetadata;
    storyboard: StoryboardProject;
    receipt: Extract<VideoRenderReceipt, { status: 'completed' }>;
} {
    return {
        metadata: {
            userId: 'user-1',
            masterFingerprint: 'fingerprint-1',
            songIntake: {
                recordingEntityId,
                ownerUid: 'user-1',
            },
        } as unknown as ExtendedGoldenMetadata,
        storyboard: {
            id: 'storyboard-1',
            name: 'Night Drive',
            canonicalRecordingEntityId: recordingEntityId,
            videoKind: 'OFFICIAL_MUSIC_VIDEO',
            audioUrl: 'gs://private-bucket/master.wav',
            bpm: 120,
            durationSeconds: 30,
            slots: [],
        },
        receipt: {
            status: 'completed',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 100,
            asset: {
                url: 'https://private.example/render-1?token=temporary',
                expiresAt: 1_800_000_000_000,
                generation: '12345',
                mimeType: 'video/mp4',
                storageRef: 'gs://private-bucket/private-renders/user-1/project-1/render-1/master-pass/final_output.mp4',
            },
        },
    };
}

describe('StoryboardVideoIdentityService', () => {
    const service = new StoryboardVideoIdentityService();
    const observedAt = '2026-09-24T12:00:00.000Z';

    it('creates a canonical video, immutable master asset and confirmed recording relationship', () => {
        const { metadata, storyboard, receipt } = fixtures();
        const identity = service.create(metadata, storyboard, receipt, observedAt);

        expect(identity?.video).toMatchObject({
            id: 'video:render-1',
            entityType: 'video_resource',
            videoKind: 'OFFICIAL_MUSIC_VIDEO',
            provenance: { state: 'USER_CONFIRMED' },
        });
        expect(identity?.asset).toMatchObject({
            id: 'asset:render-1',
            assetKind: 'VIDEO_MASTER',
            storageRef: receipt.asset.storageRef,
            storageGeneration: receipt.asset.generation,
            provenance: { state: 'DETECTED' },
        });
        expect(identity?.musicRelationships[0]).toMatchObject({
            fromEntityId: 'video:render-1',
            toEntityId: recordingEntityId,
            type: 'USES_FULL_RECORDING',
            provenance: { state: 'USER_CONFIRMED' },
        });
        expect(identity?.platformIdentifiers).toEqual([]);
    });

    it('does not create a canonical identity without a user designation or stable storage reference', () => {
        const { metadata, storyboard, receipt } = fixtures();
        expect(service.create(metadata, { ...storyboard, videoKind: undefined }, receipt, observedAt)).toBeNull();
        expect(service.create(metadata, storyboard, {
            ...receipt,
            asset: { ...receipt.asset, storageRef: undefined },
        }, observedAt)).toBeNull();
    });

    it('rejects recording or owner conflicts rather than silently relinking a video', () => {
        const { metadata, storyboard, receipt } = fixtures();
        expect(() => service.create(metadata, {
            ...storyboard,
            canonicalRecordingEntityId: 'recording:other',
        }, receipt, observedAt)).toThrow(/does not match the saved song intake/i);

        expect(() => service.create({
            ...metadata,
            userId: 'another-user',
        }, storyboard, receipt, observedAt)).toThrow(/owner does not match/i);
    });

    it('rejects a reused render ID when canonical video or asset facts conflict', () => {
        const { metadata, storyboard, receipt } = fixtures();
        const prior = service.create(metadata, storyboard, receipt, observedAt);
        if (!prior) throw new Error('Expected canonical identity fixture.');
        const metadataWithConflict = {
            ...metadata,
            videoMusicIdentities: [{
                ...prior,
                asset: { ...prior.asset, storageGeneration: '99999' },
            }],
        };

        expect(() => service.create(metadataWithConflict, storyboard, receipt, observedAt)).toThrow(/reused for conflicting/i);
    });
});
