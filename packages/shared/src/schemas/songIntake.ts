import { z } from 'zod';
import type { ArtistContext } from './artistContext.js';
import { ProvenanceSchema } from './musicEntity.js';

const IsoDateTime = z.string().datetime();
const Id = z.string().trim().min(1).max(200);

export const RecordingKindSchema = z.enum([
  'ORIGINAL', 'REMIX', 'REMASTER', 'LIVE', 'ALTERNATE', 'INSTRUMENTAL',
  'ACAPELLA', 'EDIT', 'COVER', 'UNKNOWN',
]);
export type RecordingKind = z.infer<typeof RecordingKindSchema>;

export const DetectedAudioTagSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(1000),
  provenance: ProvenanceSchema,
  requiresHumanConfirmation: z.boolean().default(true),
}).strict();

export const CatalogMatchSchema = z.object({
  entityId: Id.optional(),
  legacyTrackId: Id.optional(),
  matchType: z.enum(['EXACT_BINARY', 'EXACT_FINGERPRINT', 'IDENTIFIER', 'POSSIBLE_METADATA']),
  confidence: z.number().min(0).max(1),
  provenance: ProvenanceSchema,
}).strict();

export const SongIntakeQuestionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(1000),
  authoritative: z.boolean().default(false),
}).strict();
export type SongIntakeQuestion = z.infer<typeof SongIntakeQuestionSchema>;

export const SongIntakeSchema = z.object({
  schemaVersion: z.literal('song-intake.v1'),
  intakeId: Id,
  ownerUid: Id,
  recordingEntityId: Id,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  fingerprint: Id,
  originalFileName: z.string().trim().min(1).max(512),
  recordingKind: RecordingKindSchema.default('UNKNOWN'),
  technicalAnalysisComplete: z.boolean(),
  embeddedTags: z.record(z.string(), DetectedAudioTagSchema).default({}),
  catalogMatches: z.array(CatalogMatchSchema).max(100).default([]),
  possibleExistingRelease: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  questions: z.array(SongIntakeQuestionSchema).max(50).default([]),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).strict();
export type SongIntake = z.infer<typeof SongIntakeSchema>;

export type SongIntakePlanInput = Omit<SongIntake, 'questions'> & { artistContext?: ArtistContext };

/** Deterministic gap planner. Context changes guidance/questions, never truth requirements. */
export function planSongIntakeQuestions(input: SongIntakePlanInput): SongIntakeQuestion[] {
  const questions: SongIntakeQuestion[] = [];
  const tags = input.embeddedTags;
  const context = input.artistContext;
  const knownArtistType = context?.facts['identity.artistType'];

  if (input.recordingKind === 'UNKNOWN') {
    questions.push({
      key: 'recording.kind',
      prompt: 'What kind of recording is this: original, remix, remaster, live, alternate mix, instrumental, acapella, edit, or cover?',
      reason: 'The audio cannot authoritatively determine its relationship to another recording or work.',
      authoritative: true,
    });
  }
  if (!tags.title) questions.push({ key: 'recording.title', prompt: 'What is the recording title?', reason: 'No embedded title was detected.', authoritative: true });
  if (!tags.artist && !knownArtistType) questions.push({ key: 'recording.artist', prompt: 'Which artist should this recording be credited to?', reason: 'Neither embedded metadata nor Artist Context identifies the credited artist.', authoritative: true });
  if (input.possibleExistingRelease === 'UNKNOWN') {
    questions.push({ key: 'release.history', prompt: 'Has this recording been released before?', reason: 'Release history changes identifier-preservation and catalog-reconciliation steps.', authoritative: true });
  }
  if (input.recordingKind !== 'ORIGINAL' && input.recordingKind !== 'UNKNOWN' && !tags.originaltitle) {
    questions.push({ key: 'recording.sourceRelationship', prompt: 'Which original work or recording is this version based on?', reason: 'A derivative/version relationship must reference the canonical source.', authoritative: true });
  }
  for (const key of ['isrc', 'iswc', 'upc']) {
    if (tags[key]) questions.push({ key: `identifier.confirm.${key}`, prompt: `Confirm the detected ${key.toUpperCase()} before it is used.`, reason: 'Embedded identifiers are detected evidence, not canonical identity or verified authority.', authoritative: true });
  }
  return questions;
}

export function withPlannedSongIntakeQuestions(input: SongIntakePlanInput): SongIntake {
  const { artistContext: _plannerContext, ...persisted } = input;
  return SongIntakeSchema.parse({ ...persisted, questions: planSongIntakeQuestions(input) });
}
