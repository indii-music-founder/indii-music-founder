import {
    AssetEntitySchema,
    MusicRelationshipSchema,
    VideoMusicIdentitySchema,
    VideoResourceEntitySchema,
    type VideoKind,
    type VideoMusicIdentity,
} from '@indii/shared';
import type { StoryboardProject } from '../schemas/storyboard';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { VideoRenderReceipt } from '@/services/video/RenderService';

function canonicalVideoIdentity(input: {
    renderId: string;
    recordingEntityId: string;
    title: string;
    videoKind: VideoKind;
    storageRef: string;
    generation: string;
    observedAt: string;
    ownerUid: string;
}): VideoMusicIdentity {
    const videoEntityId = `video:${input.renderId}`;
    const assetEntityId = `asset:${input.renderId}`;
    const userProvenance = {
        state: 'USER_CONFIRMED' as const,
        sourceType: 'USER' as const,
        sourceId: input.ownerUid,
        evidence: [],
        observedAt: input.observedAt,
        confirmedAt: input.observedAt,
    };
    const systemProvenance = {
        state: 'DETECTED' as const,
        sourceType: 'SYSTEM' as const,
        sourceId: input.renderId,
        evidence: [],
        observedAt: input.observedAt,
    };
    const video = VideoResourceEntitySchema.parse({
        schemaVersion: 'canonical-music-entity.v1',
        id: videoEntityId,
        entityType: 'video_resource',
        title: input.title,
        videoKind: input.videoKind,
        provenance: userProvenance,
        createdAt: input.observedAt,
        updatedAt: input.observedAt,
    });
    const asset = AssetEntitySchema.parse({
        schemaVersion: 'canonical-music-entity.v1',
        id: assetEntityId,
        entityType: 'asset',
        assetKind: 'VIDEO_MASTER',
        fileName: `${input.title}.mp4`,
        mimeType: 'video/mp4',
        storageRef: input.storageRef,
        storageGeneration: input.generation,
        provenance: systemProvenance,
        createdAt: input.observedAt,
        updatedAt: input.observedAt,
    });
    const relationship = MusicRelationshipSchema.parse({
        schemaVersion: 'music-relationship.v1',
        id: `rel:${input.renderId}`,
        fromEntityId: videoEntityId,
        toEntityId: input.recordingEntityId,
        type: 'USES_FULL_RECORDING',
        status: 'ACTIVE',
        attributes: { source: 'private-storyboard-render' },
        provenance: userProvenance,
        createdAt: input.observedAt,
        updatedAt: input.observedAt,
    });
    return VideoMusicIdentitySchema.parse({
        schemaVersion: 'video-music-identity.v1',
        video,
        asset,
        musicRelationships: [relationship],
        platformIdentifiers: [],
    });
}

export class StoryboardVideoIdentityService {
    create(metadata: ExtendedGoldenMetadata, storyboard: StoryboardProject, receipt: VideoRenderReceipt, observedAt = new Date().toISOString()): VideoMusicIdentity | null {
        if (receipt.status !== 'completed' || !receipt.asset.storageRef) return null;
        if (!storyboard.canonicalRecordingEntityId || !storyboard.videoKind) return null;
        if (metadata.songIntake?.recordingEntityId !== storyboard.canonicalRecordingEntityId) {
            throw new Error('Storyboard recording identity does not match the saved song intake.');
        }
        const ownerUid = metadata.userId ?? metadata.songIntake?.ownerUid;
        if (!ownerUid || (metadata.songIntake && metadata.songIntake.ownerUid !== ownerUid)) {
            throw new Error('Video identity owner does not match the canonical song intake owner.');
        }
        const identity = canonicalVideoIdentity({
            renderId: receipt.renderId,
            recordingEntityId: storyboard.canonicalRecordingEntityId,
            title: storyboard.name,
            videoKind: storyboard.videoKind,
            storageRef: receipt.asset.storageRef,
            generation: receipt.asset.generation,
            observedAt,
            ownerUid,
        });
        const prior = metadata.videoMusicIdentities?.find(existing => existing.video.id === identity.video.id);
        const priorRelationship = prior?.musicRelationships.find(relationship => relationship.id === `rel:${receipt.renderId}`);
        const expectedRelationship = identity.musicRelationships[0];
        if (prior && (
            prior.video.title !== identity.video.title
            || prior.video.videoKind !== identity.video.videoKind
            || prior.asset.storageRef !== identity.asset.storageRef
            || prior.asset.storageGeneration !== identity.asset.storageGeneration
            || priorRelationship?.fromEntityId !== expectedRelationship?.fromEntityId
            || priorRelationship?.toEntityId !== expectedRelationship?.toEntityId
            || priorRelationship?.type !== expectedRelationship?.type
        )) {
            throw new Error('A render ID cannot be reused for conflicting canonical video identity.');
        }
        return prior ?? identity;
    }
}
