import { describe, expect, it } from 'vitest';
import { VideoMusicIdentitySchema } from './videoMusicIdentity.js';

const now = '2026-09-24T14:00:00.000Z';
const provenance = { state: 'USER_CONFIRMED' as const, sourceType: 'USER' as const, evidence: [], observedAt: now, confirmedAt: now };
const identity = {
  schemaVersion: 'video-music-identity.v1' as const,
  video: {
    schemaVersion: 'canonical-music-entity.v1' as const,
    id: 'video:render-1', entityType: 'video_resource' as const, title: 'Storyboard', videoKind: 'PROMOTIONAL' as const,
    createdAt: now, updatedAt: now, provenance,
  },
  asset: {
    schemaVersion: 'canonical-music-entity.v1' as const,
    id: 'asset:render-1', entityType: 'asset' as const, assetKind: 'VIDEO_MASTER' as const,
    storageRef: 'gs://bucket/private-renders/user-1/project-1/render-1/master-pass/final_output.mp4',
    storageGeneration: '123456789', mimeType: 'video/mp4', createdAt: now, updatedAt: now,
  },
  musicRelationships: [{
    schemaVersion: 'music-relationship.v1' as const,
    id: 'rel:render-1', fromEntityId: 'video:render-1', toEntityId: 'recording:master-1', type: 'USES_FULL_RECORDING' as const,
    status: 'ACTIVE' as const, attributes: {}, provenance, createdAt: now, updatedAt: now,
  }],
  platformIdentifiers: [{
    id: 'identifier:youtube:render-1', entityId: 'video:render-1', type: 'PLATFORM_ID' as const,
    namespace: 'youtube', value: 'yt-video-123', status: 'ACTIVE' as const,
    provenance: { state: 'DETECTED' as const, sourceType: 'EXTERNAL_SERVICE' as const, evidence: [], observedAt: now },
  }],
};

describe('VideoMusicIdentitySchema', () => {
  it('keeps canonical video and recording identity separate from its platform identifier', () => {
    expect(VideoMusicIdentitySchema.parse(identity)).toMatchObject({
      video: { id: 'video:render-1' },
      asset: { id: 'asset:render-1', storageGeneration: '123456789' },
      musicRelationships: [{ toEntityId: 'recording:master-1', type: 'USES_FULL_RECORDING' }],
      platformIdentifiers: [{ entityId: 'video:render-1', value: 'yt-video-123' }],
    });
  });

  it('rejects platform IDs used as the canonical recording target', () => {
    expect(() => VideoMusicIdentitySchema.parse({
      ...identity,
      musicRelationships: [{ ...identity.musicRelationships[0], toEntityId: 'USABC2600001' }],
    })).toThrow(/internal recording/i);
  });

  it('requires stable immutable storage identity and explicit relationship semantics', () => {
    expect(() => VideoMusicIdentitySchema.parse({ ...identity, asset: { ...identity.asset, storageGeneration: undefined } })).toThrow(/immutable storage generation/i);
    expect(() => VideoMusicIdentitySchema.parse({ ...identity, musicRelationships: [] })).toThrow(/explicit recording-use relationship/i);
  });

  it('rejects a platform identifier attached to a different or noncanonical video identity', () => {
    expect(() => VideoMusicIdentitySchema.parse({
      ...identity,
      platformIdentifiers: [{ ...identity.platformIdentifiers[0], entityId: 'yt-video-123' }],
    })).toThrow(/identifiers of this video entity/i);
  });
});
