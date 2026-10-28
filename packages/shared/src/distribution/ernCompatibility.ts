import type { IngestionNotificationMessage } from './types/ern.js';
import type { DDEXContainsAI } from './types/common.js';
import type { AITrainingGrant } from '../rights/aiTrainingConsent.js';

export type DSPReceiverProfile = 'Spotify' | 'AppleMusic' | 'YouTubeMusic' | 'GeneralDDEX';

export interface ProfileComplianceIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  resourceReference?: string;
}

export interface DSPProfileCheckResult {
  profile: DSPReceiverProfile;
  compatible: boolean;
  issues: ProfileComplianceIssue[];
}

export interface ERNCompatibilityAssessment {
  schemaVersion: '4.3' | '4.3.2';
  isStandardCompliant: boolean;
  containsAiOverall: DDEXContainsAI;
  humanElectronicPreserved: boolean;
  trainingConsentSeparated: boolean;
  dspProfiles: Record<DSPReceiverProfile, DSPProfileCheckResult>;
  summary: string[];
}

export interface MusicAIClassificationInput {
  isElectronic?: boolean;
  usesDAW?: boolean;
  usesSynthesizers?: boolean;
  usesLicensedSamples?: boolean;
  usesAIAssistedTools?: boolean; // e.g. AI vocal tuning, mastering assist
  isGenerativeAISynthesis?: boolean; // e.g. text-to-audio model, Suno/Udio prompt
}

/**
 * Classifies track AI content according to DDEX ERN 4.3.2 standards.
 *
 * CRITICAL POLICY RULE: Human-created electronic music, synth programming, DAW arrangements,
 * and licensed sample collages are 100% human-created artistry and MUST NOT be classified
 * as AI-generated (`ContainsAI: 'None'`).
 */
export function classifyMusicAIStatus(input: MusicAIClassificationInput): {
  containsAi: DDEXContainsAI;
  reason: string;
  isHumanElectronicPreserved: boolean;
} {
  if (input.isGenerativeAISynthesis) {
    return {
      containsAi: 'All',
      reason: 'Track audio content is generated via generative AI synthesis.',
      isHumanElectronicPreserved: false,
    };
  }

  if (input.usesAIAssistedTools) {
    return {
      containsAi: 'Partly',
      reason: 'Human-directed composition utilizing AI-assisted processing tools (e.g., vocal tuning, stem separation, mastering).',
      isHumanElectronicPreserved: false,
    };
  }

  // Pure human, electronic, synth, or sample-based
  const electronicElements: string[] = [];
  if (input.isElectronic) electronicElements.push('electronic arrangement');
  if (input.usesDAW) electronicElements.push('DAW production');
  if (input.usesSynthesizers) electronicElements.push('hardware/software synthesizers');
  if (input.usesLicensedSamples) electronicElements.push('licensed sample usage');

  const desc = electronicElements.length > 0
    ? `Human-authored production featuring ${electronicElements.join(', ')}.`
    : 'Fully human-authored composition and sound recording.';

  return {
    containsAi: 'None',
    reason: desc,
    isHumanElectronicPreserved: electronicElements.length > 0,
  };
}

/**
 * Verifies that outbound DDEX distribution metadata does NOT confer or imply
 * rights to train generative AI models.
 *
 * DDEX ERN deals authorize commercial dissemination (streaming, downloading)
 * to end consumers, NOT algorithmic training or ingestion by LLMs/diffusion models.
 */
export function verifyDistributionVsTrainingBoundary(
  ern: IngestionNotificationMessage,
  trainingGrant?: AITrainingGrant | null
): {
  isolated: boolean;
  hasUnauthorizedTrainingClause: boolean;
  explicitTrainingLicensePresent: boolean;
  details: string;
} {
  // Check whether any deal in the ERN mentions AI training or unauthorized exploitation
  let hasUnauthorizedTrainingClause = false;
  for (const deal of ern.dealList) {
    const commercialModel = deal.dealTerms.commercialModelType;
    if (commercialModel.toLowerCase().includes('training') || commercialModel.toLowerCase().includes('model_ingestion')) {
      hasUnauthorizedTrainingClause = true;
    }
  }

  const explicitTrainingLicensePresent = !!trainingGrant && trainingGrant.scopes.length > 0;

  return {
    isolated: !hasUnauthorizedTrainingClause,
    hasUnauthorizedTrainingClause,
    explicitTrainingLicensePresent,
    details: hasUnauthorizedTrainingClause
      ? 'CRITICAL SECURITY BREACH: Deal terms include unapproved AI training commercial model.'
      : 'Verified: DDEX ERN delivery is strictly isolated to consumer DSP playback/download.',
  };
}

/**
 * Assesses complete ERN message against DDEX ERN 4.3.2 specifications and DSP receiver profiles.
 */
export function assessERNCompatibility(
  ern: IngestionNotificationMessage,
  trainingGrant?: AITrainingGrant | null
): ERNCompatibilityAssessment {
  const issuesByProfile: Record<DSPReceiverProfile, ProfileComplianceIssue[]> = {
    Spotify: [],
    AppleMusic: [],
    YouTubeMusic: [],
    GeneralDDEX: [],
  };

  const summary: string[] = [];

  // 1. General DDEX 4.3 / 4.3.2 Schema Validation
  if (ern.messageSchemaVersionId !== '4.3' && ern.messageSchemaVersionId !== '4.3.2') {
    issuesByProfile.GeneralDDEX.push({
      severity: 'ERROR',
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      message: `Message schema version ${ern.messageSchemaVersionId} is unsupported. Expected '4.3' or '4.3.2'.`,
    });
  }

  if (!ern.releaseList || ern.releaseList.length === 0) {
    issuesByProfile.GeneralDDEX.push({
      severity: 'ERROR',
      code: 'EMPTY_RELEASE_LIST',
      message: 'ReleaseList cannot be empty in valid DDEX ERN.',
    });
  }

  if (!ern.dealList || ern.dealList.length === 0) {
    issuesByProfile.GeneralDDEX.push({
      severity: 'ERROR',
      code: 'EMPTY_DEAL_LIST',
      message: 'DealList must contain at least one commercial deal.',
    });
  }

  // 2. Resource & AI Metadata Checks
  let containsAiOverall: DDEXContainsAI = 'None';
  let humanElectronicPreserved = false;

  for (const release of ern.releaseList) {
    if (release.aiGenerationInfo?.containsAi === 'All' || release.aiGenerationInfo?.isFullyAIGenerated) {
      containsAiOverall = 'All';
    } else if (
      containsAiOverall !== 'All' &&
      (release.aiGenerationInfo?.containsAi === 'Partly' || release.aiGenerationInfo?.isPartiallyAIGenerated)
    ) {
      containsAiOverall = 'Partly';
    }
  }

  for (const resource of ern.resourceList) {
    if (resource.resourceType === 'SoundRecording') {
      const isrc = resource.resourceId.isrc;
      if (!isrc) {
        issuesByProfile.GeneralDDEX.push({
          severity: 'ERROR',
          code: 'MISSING_ISRC',
          message: `SoundRecording ${resource.resourceReference} is missing an ISRC.`,
          resourceReference: resource.resourceReference,
        });
      }

      // Profile Checks: Spotify requires valid ISRC and explicit AI disclosure tagging
      if (resource.aiGenerationInfo) {
        const containsAi = resource.aiGenerationInfo.containsAi ??
          (resource.aiGenerationInfo.isFullyAIGenerated ? 'All' : resource.aiGenerationInfo.isPartiallyAIGenerated ? 'Partly' : 'None');

        if (containsAi === 'None') {
          humanElectronicPreserved = true;
        }

        if (containsAi === 'All' && (!resource.contributors || resource.contributors.length === 0)) {
          issuesByProfile.Spotify.push({
            severity: 'WARNING',
            code: 'SPOTIFY_AI_CONTRIBUTOR_MISSING',
            message: 'Spotify prefers explicit AI tool attribution when ContainsAI is All.',
            resourceReference: resource.resourceReference,
          });
        }
      }

      // Apple Music requires TitleText and parental warning type
      if (!resource.resourceTitle?.titleText) {
        issuesByProfile.AppleMusic.push({
          severity: 'ERROR',
          code: 'APPLE_MISSING_TITLE',
          message: `SoundRecording ${resource.resourceReference} missing title.`,
          resourceReference: resource.resourceReference,
        });
      }
    }
  }

  // 3. YouTube Music Content ID / Profile
  for (const deal of ern.dealList) {
    if (deal.dealTerms.commercialModelType === 'AdvertisementSupportedModel' && !deal.dealTerms.territoryCode) {
      issuesByProfile.YouTubeMusic.push({
        severity: 'WARNING',
        code: 'YOUTUBE_TERRITORY_UNSPECIFIED',
        message: 'YouTube Music ad-supported deals should specify territory explicit scope.',
      });
    }
  }

  // 4. Boundary verification
  const boundary = verifyDistributionVsTrainingBoundary(ern, trainingGrant);
  if (!boundary.isolated) {
    issuesByProfile.GeneralDDEX.push({
      severity: 'ERROR',
      code: 'TRAINING_RIGHTS_POLLUTION',
      message: boundary.details,
    });
  }

  // Construct results per profile
  const dspProfiles: Record<DSPReceiverProfile, DSPProfileCheckResult> = {
    Spotify: {
      profile: 'Spotify',
      compatible: issuesByProfile.Spotify.filter((i) => i.severity === 'ERROR').length === 0,
      issues: issuesByProfile.Spotify,
    },
    AppleMusic: {
      profile: 'AppleMusic',
      compatible: issuesByProfile.AppleMusic.filter((i) => i.severity === 'ERROR').length === 0,
      issues: issuesByProfile.AppleMusic,
    },
    YouTubeMusic: {
      profile: 'YouTubeMusic',
      compatible: issuesByProfile.YouTubeMusic.filter((i) => i.severity === 'ERROR').length === 0,
      issues: issuesByProfile.YouTubeMusic,
    },
    GeneralDDEX: {
      profile: 'GeneralDDEX',
      compatible: issuesByProfile.GeneralDDEX.filter((i) => i.severity === 'ERROR').length === 0,
      issues: issuesByProfile.GeneralDDEX,
    },
  };

  const isStandardCompliant = dspProfiles.GeneralDDEX.compatible;
  summary.push(`DDEX ERN ${ern.messageSchemaVersionId} compliance: ${isStandardCompliant ? 'PASS' : 'FAIL'}`);
  summary.push(`Overall ContainsAI status: ${containsAiOverall}`);
  summary.push(`Distribution vs training consent isolated: ${boundary.isolated ? 'YES' : 'NO'}`);

  return {
    schemaVersion: ern.messageSchemaVersionId,
    isStandardCompliant,
    containsAiOverall,
    humanElectronicPreserved,
    trainingConsentSeparated: boundary.isolated,
    dspProfiles,
    summary,
  };
}
