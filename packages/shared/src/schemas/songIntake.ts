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

/**
 * A confirmation is deliberately separate from inspection output.  Upload
 * analysis can suggest metadata, but cannot assert ownership, clearance, or
 * a release/dispute intention on the artist's behalf.
 */
export const SongIntakeConfirmationSchema = z.object({
  value: z.union([
    z.string().trim().min(1).max(4000),
    z.boolean(),
    z.array(z.string().trim().min(1).max(500)).max(200),
  ]),
  provenance: ProvenanceSchema.refine(
    ({ state, sourceType }) => state === 'USER_DECLARED' || state === 'USER_CONFIRMED' || state === 'DOCUMENTED' || state === 'DISPUTED' || sourceType === 'IMPORT',
    'Intake confirmations must retain a user, document, import, or dispute provenance state.'
  ),
}).strict();
export type SongIntakeConfirmation = z.infer<typeof SongIntakeConfirmationSchema>;

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
  /** Human answers; never overwrite detected tags or inferred catalog matches. */
  confirmations: z.record(z.string().trim().min(1).max(120), SongIntakeConfirmationSchema).default({}),
  questions: z.array(SongIntakeQuestionSchema).max(50).default([]),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).strict();
export type SongIntake = z.infer<typeof SongIntakeSchema>;

export type SongIntakePlanInput = Omit<SongIntake, 'questions' | 'confirmations'> & {
  /** Optional at the planner boundary for pre-Phase-4 persisted intakes. */
  confirmations?: SongIntake['confirmations'];
  artistContext?: ArtistContext;
};

/** Deterministic gap planner. Context changes guidance/questions, never truth requirements. */
export function planSongIntakeQuestions(input: SongIntakePlanInput): SongIntakeQuestion[] {
  const questions: SongIntakeQuestion[] = [];
  const tags = input.embeddedTags;
  const context = input.artistContext;
  // Callers can be legacy persisted intakes that predate this optional field;
  // normalize before planning, while schema parsing persists the default.
  const confirmations = input.confirmations ?? {};
  const hasConfirmation = (key: string) => Boolean(confirmations[key]);
  const creditedArtist = context?.facts['identity.displayName'];
  const hasAuthoritativeArtistContext = Boolean(
    creditedArtist && ['USER_CONFIRMED', 'DOCUMENTED', 'EXTERNAL_VERIFIED'].includes(creditedArtist.provenance.state)
  );

  if (input.recordingKind === 'UNKNOWN') {
    questions.push({
      key: 'recording.kind',
      prompt: 'What kind of recording is this: original, remix, remaster, live, alternate mix, instrumental, acapella, edit, or cover?',
      reason: 'The audio cannot authoritatively determine its relationship to another recording or work.',
      authoritative: true,
    });
  }
  if (!tags.title) questions.push({ key: 'recording.title', prompt: 'What is the recording title?', reason: 'No embedded title was detected.', authoritative: true });
  if (!tags.artist && !hasAuthoritativeArtistContext && !hasConfirmation('recording.artist')) questions.push({ key: 'recording.artist', prompt: 'Which artist should this recording be credited to?', reason: 'Artist type is not a credit. No confirmed credited artist is available.', authoritative: true });
  if (input.possibleExistingRelease === 'UNKNOWN') {
    questions.push({ key: 'release.history', prompt: 'Has this recording been released before?', reason: 'Release history changes identifier-preservation and catalog-reconciliation steps.', authoritative: true });
  }
  if (input.recordingKind !== 'ORIGINAL' && input.recordingKind !== 'UNKNOWN' && !tags.originaltitle) {
    questions.push({ key: 'recording.sourceRelationship', prompt: 'Which original work or recording is this version based on?', reason: 'A derivative/version relationship must reference the canonical source.', authoritative: true });
  }
  for (const key of ['isrc', 'iswc', 'upc']) {
    if (tags[key] && !hasConfirmation(`identifier.confirm.${key}`)) questions.push({ key: `identifier.confirm.${key}`, prompt: `Confirm the detected ${key.toUpperCase()} before it is used.`, reason: 'Embedded identifiers are detected evidence, not canonical identity or verified authority.', authoritative: true });
  }
  if (!hasConfirmation('rights.masterOwnership')) questions.push({ key: 'rights.masterOwnership', prompt: 'Who owns or controls the master recording, and do you have authority to distribute it?', reason: 'Ownership and distribution authority cannot be inferred from an upload.', authoritative: true });
  if (!hasConfirmation('rights.compositionWriters')) questions.push({ key: 'rights.compositionWriters', prompt: 'List every writer and the proposed composition split; identify anything pending or disputed.', reason: 'Writer credits and splits require explicit human confirmation.', authoritative: true });
  if (!hasConfirmation('rights.samples')) questions.push({ key: 'rights.samples', prompt: 'Does this recording use any sample, interpolation, loop, beat lease, or third-party source? If yes, provide its clearance or license status.', reason: 'Audio inspection cannot determine source rights or clearance.', authoritative: true });
  if (!hasConfirmation('video.officialDesignation')) questions.push({ key: 'video.officialDesignation', prompt: 'Is there an official video associated with this recording, or should none be designated?', reason: 'Official-video status is a human designation, not an audio attribute.', authoritative: true });
  if (!hasConfirmation('migration.intent')) questions.push({ key: 'migration.intent', prompt: 'Is this a catalog migration or replacement that should preserve existing history and identifiers?', reason: 'Migration intent changes reconciliation but must not be guessed from a match.', authoritative: true });
  if (!hasConfirmation('dispute.intent')) questions.push({ key: 'dispute.intent', prompt: 'Is any ownership, credit, identifier, or release-history fact disputed?', reason: 'Potential conflicts must remain visible rather than being silently resolved.', authoritative: true });
  return questions;
}

export function withPlannedSongIntakeQuestions(input: SongIntakePlanInput): SongIntake {
  const { artistContext: _plannerContext, ...persisted } = input;
  return SongIntakeSchema.parse({ ...persisted, questions: planSongIntakeQuestions(input) });
}
