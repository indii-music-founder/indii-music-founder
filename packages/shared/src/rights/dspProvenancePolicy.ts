import { z } from 'zod';

/**
 * Industry-reported DSP enforcement metrics for AI & low-quality content.
 * Policy directive: Never conflate recommendation filtering with complete platform removal.
 */
export const DSP_REPORTED_METRICS = {
  /** Tracks removed from recommendations / algorithmic discovery by Spotify */
  RECOMMENDATION_REMOVALS_COUNT: 50_000_000,
  /** Tracks removed from the catalog / platform entirely by Spotify */
  PLATFORM_REMOVALS_COUNT: 75_000_000,
  REFERENCE_DATE: '2026-10-20',
  SOURCE: 'Spotify Prioritizing Human Artistry Report / Believe Partnership Announcement',
} as const;

/**
 * Core Authorship Classification for DSP release & provenance.
 */
export const AuthorshipClassificationSchema = z.enum([
  'human_original',
  'human_assisted_ai',
  'synthetic_ai_generated',
]);
export type AuthorshipClassification = z.infer<typeof AuthorshipClassificationSchema>;

/**
 * Legitimate human production techniques.
 * Electronic production, MIDI sequencing, and sample-based collage are human music
 * and must be protected from automated false rejection.
 */
export const ProductionMethodSchema = z.enum([
  'live_acoustic_performance',
  'electronic_daw_midi',
  'sample_based_composition',
  'hybrid_acoustic_electronic',
  'algorithmic_generative_prompt',
]);
export type ProductionMethod = z.infer<typeof ProductionMethodSchema>;

/**
 * AI Assistance Disclosure Schema conforming to DDEX ERN 4.3 standards.
 */
export const AIAssistanceDisclosureSchema = z.object({
  usedAIAssistance: z.boolean(),
  toolsUsed: z.array(z.string().trim().min(1).max(100)),
  humanContributionDescription: z.string().trim().max(1000).optional(),
}).strict();
export type AIAssistanceDisclosure = z.infer<typeof AIAssistanceDisclosureSchema>;

/**
 * Third-party remix / cover license consent structure.
 * Reflects Spotify / Believe agreement requirements for fan-made covers and remixes.
 */
export const RemixLicenseConsentSchema = z.object({
  isRemixOrCover: z.boolean(),
  originalWorkTitle: z.string().trim().min(1).max(200).optional(),
  originalRightsholder: z.string().trim().min(1).max(200).optional(),
  licenseAgreementId: z.string().trim().min(1).max(200).optional(),
  clearedThroughDSPAgreement: z.boolean().default(false),
}).strict();
export type RemixLicenseConsent = z.infer<typeof RemixLicenseConsentSchema>;

/**
 * Complete Provenance Track Record for DSP distribution.
 */
export const DSPProvenanceTrackInputSchema = z.object({
  trackId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  classification: AuthorshipClassificationSchema,
  productionMethods: z.array(ProductionMethodSchema).min(1),
  aiDisclosure: AIAssistanceDisclosureSchema,
  remixConsent: RemixLicenseConsentSchema,
  aiTrainingOptIn: z.boolean().default(false),
}).strict();
export type DSPProvenanceTrack = z.infer<typeof DSPProvenanceTrackInputSchema>;
export type DSPProvenanceTrackInput = z.input<typeof DSPProvenanceTrackInputSchema>;

export interface DSPProvenanceEvaluationResult {
  eligibleForDistribution: boolean;
  eligibleForRecommendations: boolean;
  reason?: string;
  flags: Array<'HUMAN_ARTISTRY_CONFIRMED' | 'AI_ASSISTANCE_DISCLOSED' | 'SYNTHETIC_PROHIBITED' | 'REMIX_LICENSE_REQUIRED' | 'TRAINING_SEPARATED'>;
  authorshipStatus: 'verified_human' | 'human_assisted_disclosed' | 'rejected_synthetic';
}

/**
 * Deterministically evaluates a track against DSP human-artistry and provenance rules.
 *
 * Rules:
 * 1. Fully synthetic AI-generated tracks cannot be distributed as human artistry.
 * 2. Legitimate DAW, MIDI, and sample-based works are protected from false rejection.
 * 3. AI assistance requires explicit tool disclosure and human contribution description.
 * 4. Fan remixes and covers require third-party licensing clearance (or DSP partner clearance).
 * 5. Model training consent is completely decoupled from distribution eligibility.
 */
export function evaluateDSPProvenanceCompliance(
  input: DSPProvenanceTrackInput
): DSPProvenanceEvaluationResult {
  const flags: DSPProvenanceEvaluationResult['flags'] = [];

  // Model training is decoupled
  flags.push('TRAINING_SEPARATED');

  // Rule 1: Synthetic AI tracks are barred from indii.music distribution
  if (
    input.classification === 'synthetic_ai_generated' ||
    input.productionMethods.includes('algorithmic_generative_prompt')
  ) {
    return {
      eligibleForDistribution: false,
      eligibleForRecommendations: false,
      reason: 'Rejected: Fully synthetic AI-generated audio is prohibited from distribution on indii.music.',
      flags: ['SYNTHETIC_PROHIBITED', 'TRAINING_SEPARATED'],
      authorshipStatus: 'rejected_synthetic',
    };
  }

  // Rule 2: Protect electronic / DAW / sample-based music
  const isHumanProduction = input.productionMethods.some((method) =>
    ['live_acoustic_performance', 'electronic_daw_midi', 'sample_based_composition', 'hybrid_acoustic_electronic'].includes(method)
  );

  if (input.classification === 'human_original' && isHumanProduction) {
    flags.push('HUMAN_ARTISTRY_CONFIRMED');
  }

  // Rule 3: AI-assisted tracks must provide explicit disclosure
  if (input.classification === 'human_assisted_ai') {
    if (!input.aiDisclosure.usedAIAssistance) {
      return {
        eligibleForDistribution: false,
        eligibleForRecommendations: false,
        reason: 'Inconsistent disclosure: Track classified as AI-assisted but usedAIAssistance is false.',
        flags,
        authorshipStatus: 'rejected_synthetic',
      };
    }

    if (input.aiDisclosure.toolsUsed.length === 0) {
      return {
        eligibleForDistribution: false,
        eligibleForRecommendations: false,
        reason: 'Disclosure required: AI-assisted track must list autonomous tools used.',
        flags,
        authorshipStatus: 'rejected_synthetic',
      };
    }

    if (!input.aiDisclosure.humanContributionDescription?.trim()) {
      return {
        eligibleForDistribution: false,
        eligibleForRecommendations: false,
        reason: 'Disclosure required: AI-assisted track must describe the human contribution.',
        flags,
        authorshipStatus: 'rejected_synthetic',
      };
    }

    flags.push('AI_ASSISTANCE_DISCLOSED');
  }

  // Rule 4: Remix / Cover license verification
  if (input.remixConsent.isRemixOrCover) {
    const hasLicense = Boolean(
      input.remixConsent.licenseAgreementId || input.remixConsent.clearedThroughDSPAgreement
    );

    if (!hasLicense) {
      return {
        eligibleForDistribution: false,
        eligibleForRecommendations: false,
        reason: 'License required: Fan-made covers and remixes must provide an agreement ID or prove clearance under DSP agreements.',
        flags: [...flags, 'REMIX_LICENSE_REQUIRED'],
        authorshipStatus: input.classification === 'human_assisted_ai' ? 'human_assisted_disclosed' : 'verified_human',
      };
    }
  }

  const authorshipStatus =
    input.classification === 'human_assisted_ai' ? 'human_assisted_disclosed' : 'verified_human';

  return {
    eligibleForDistribution: true,
    eligibleForRecommendations: true,
    flags,
    authorshipStatus,
  };
}
