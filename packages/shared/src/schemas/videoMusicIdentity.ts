import { z } from 'zod';
import { AssetEntitySchema, MusicIdentifierSchema, VideoResourceEntitySchema } from './musicEntity.js';
import { MusicRelationshipSchema } from './musicRelationship.js';

const VideoMusicRelationshipTypeSchema = z.enum([
  'USES_FULL_RECORDING',
  'USES_RECORDING_EXCERPT',
  'USES_ALTERNATE_MIX',
  'USES_LIVE_RECORDING',
  'USES_INSTRUMENTAL',
  'USES_STEM',
  'REFERENCES_RELEASE_ONLY',
]);

/** Canonical video, immutable output asset, music relationships and platform IDs. */
export const VideoMusicIdentitySchema = z.object({
  schemaVersion: z.literal('video-music-identity.v1'),
  video: VideoResourceEntitySchema,
  asset: AssetEntitySchema,
  musicRelationships: z.array(MusicRelationshipSchema).max(100),
  /** Platform IDs are identifiers for the video entity, never entity IDs. */
  platformIdentifiers: z.array(MusicIdentifierSchema).max(100).default([]),
}).strict().superRefine((identity, ctx) => {
  if (identity.asset.assetKind !== 'VIDEO_MASTER') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['asset', 'assetKind'], message: 'Video identity requires a VIDEO_MASTER asset.' });
  }
  if (!identity.asset.storageRef?.startsWith('gs://') || !identity.asset.storageGeneration) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['asset'], message: 'Video asset identity requires a stable gs:// reference and immutable storage generation.' });
  }
  const recordingRelationships = identity.musicRelationships.filter((relationship) =>
    VideoMusicRelationshipTypeSchema.safeParse(relationship.type).success,
  );
  if (recordingRelationships.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['musicRelationships'], message: 'Video identity requires an explicit recording-use relationship.' });
  }
  for (const [index, relationship] of identity.musicRelationships.entries()) {
    if (
      relationship.fromEntityId !== identity.video.id
      || !VideoMusicRelationshipTypeSchema.safeParse(relationship.type).success
      || !relationship.toEntityId.startsWith('recording:')
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['musicRelationships', index], message: 'Video music relationships must link this VideoResource to an internal recording using explicit use semantics.' });
    }
  }
  for (const [index, identifier] of identity.platformIdentifiers.entries()) {
    if (identifier.entityId !== identity.video.id || identifier.type !== 'PLATFORM_ID' || !identifier.namespace) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['platformIdentifiers', index], message: 'Platform identifiers must remain namespaced identifiers of this video entity, not canonical identity.' });
    }
  }
});
export type VideoMusicIdentity = z.infer<typeof VideoMusicIdentitySchema>;
