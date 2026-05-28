import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { UserProfile } from '@/types/User';
import { creatorProtectionHarnessService, type CreatorProtectionRun, type IdentityProtectionProfile } from '@/services/creator-protection';
import {
  releaseHarnessService,
  saveReleaseHarnessRun,
  type ReleaseHarnessInput,
  type ReleaseHarnessResult,
} from '@/services/release-harness';
import { buildDistributionReadiness, buildReleaseDna } from '@/services/release-harness/ReleaseHarnessAdapters';
import { createHarnessRun, type HarnessRun } from './types';
import { saveHarnessRun } from './HarnessStorage';

export interface UploadIntakeHarnessInput extends Omit<ReleaseHarnessInput, 'audioProfile'> {
  audioProfile?: AudioIntelligenceProfile;
  protectionProfile?: IdentityProtectionProfile;
  save?: boolean;
}

export interface SongDnaHarnessOutput {
  releaseDna: ReturnType<typeof buildReleaseDna>;
  metadataDraft: Partial<ExtendedGoldenMetadata>;
  aiDisclosure: ExtendedGoldenMetadata['aiGeneratedContent'] | undefined;
}

export interface DistributionDdexHarnessOutput {
  readiness: ReturnType<typeof buildDistributionReadiness>;
}

export interface UploadIntakeHarnessResult {
  songDnaRun: HarnessRun<SongDnaHarnessOutput>;
  distributionRun: HarnessRun<DistributionDdexHarnessOutput>;
  creatorProtectionRun: CreatorProtectionRun;
  releaseResult: ReleaseHarnessResult;
  savedRunIds?: {
    songDna?: string;
    distribution?: string;
    creatorProtection?: string;
    release?: string;
  };
}

class UploadIntakeHarnessService {
  async compileUploadIntake(input: UploadIntakeHarnessInput): Promise<UploadIntakeHarnessResult> {
    const metadata = input.metadata ?? {};
    const releaseDna = buildReleaseDna(input.audioProfile, metadata);
    const distributionReadiness = buildDistributionReadiness({
      metadata,
      selectedStores: input.selectedStores,
    });
    const protectionProfile = input.protectionProfile ?? this.createDefaultProtectionProfile({
      userId: input.userId,
      userProfile: input.userProfile,
      metadata,
    });

    const creatorProtectionRun = creatorProtectionHarnessService.compileReadiness({
      profile: protectionProfile,
      works: [{
        workTitle: metadata.trackTitle ?? input.releaseIntent?.title ?? 'Untitled upload',
        isrc: metadata.isrc,
        upc: metadata.upc,
        iswc: metadata.iswc,
        catalogNumber: metadata.catalogNumber,
        copyrightRegistration: protectionProfile.copyrightStatus === 'registered' ? 'registered' : undefined,
        proWorkId: metadata.composerIPI,
        humanAuthorshipStatement: metadata.aiGeneratedContent?.humanContribution,
      }],
      evidenceRefs: [
        ...(releaseDna.fingerprint ? [{
          id: `fingerprint_${releaseDna.fingerprint}`,
          type: 'hash' as const,
          label: 'Audio fingerprint',
          hash: releaseDna.fingerprint,
          createdAt: new Date().toISOString(),
        }] : []),
        ...(metadata.isrc ? [{
          id: `isrc_${metadata.isrc}`,
          type: 'identifier' as const,
          label: 'ISRC',
          value: metadata.isrc,
          createdAt: new Date().toISOString(),
        }] : []),
      ],
    });

    const releaseResult = await releaseHarnessService.compileReleaseHarness({
      ...input,
      audioProfile: input.audioProfile,
      metadata,
    });

    const songDnaRun = createHarnessRun<SongDnaHarnessOutput>({
      userId: input.userId,
      projectId: input.projectId,
      domain: 'song_dna',
      inputRefs: this.buildInputRefs(input, metadata),
      scores: [{
        label: 'Song DNA Confidence',
        value: Math.round(releaseDna.confidence * 100),
        max: 100,
        status: releaseDna.confidence >= 0.75 ? 'good' : releaseDna.confidence >= 0.45 ? 'watch' : 'blocked',
        rationale: input.audioProfile ? 'Audio intelligence profile is attached.' : 'Using metadata fallback until audio analysis is available.',
      }],
      findings: [{
        id: 'song_dna_summary',
        domain: 'song_dna',
        severity: 'info',
        title: 'Creative intake compiled',
        detail: [
          releaseDna.genreSignals.length ? `Genres: ${releaseDna.genreSignals.slice(0, 4).join(', ')}` : 'Genre signals need confirmation.',
          releaseDna.moodSignals.length ? `Moods: ${releaseDna.moodSignals.slice(0, 4).join(', ')}` : 'Mood signals need confirmation.',
          typeof releaseDna.tempo === 'number' ? `Tempo: ${Math.round(releaseDna.tempo)} BPM` : 'Tempo unavailable.',
        ].join(' '),
        confidence: releaseDna.confidence >= 0.75 ? 'high' : releaseDna.confidence >= 0.45 ? 'medium' : 'low',
      }],
      recommendations: [{
        id: 'send_song_dna_to_departments',
        domain: 'song_dna',
        priority: 'medium',
        title: 'Send Song DNA to release, marketing, legal, merch, and licensing',
        detail: 'Use the compiled audio and metadata signals as the shared source of truth for downstream harnesses.',
        ownerAgentId: 'music',
        approvalRequired: false,
        nextAction: 'Run downstream harnesses from this intake packet.',
      }],
      costLines: [],
      legalBasis: [],
      evidenceRefs: creatorProtectionRun.evidenceRefs,
      agentBriefs: [{
        agentId: 'music',
        departmentId: 'music',
        brief: 'Confirm Song DNA, audio confidence, AI artifacts, explicit status, and metadata suggestions.',
        inputs: ['audio profile', 'metadata', 'fingerprint'],
      }, {
        agentId: 'marketing',
        departmentId: 'marketing',
        brief: 'Use mood, energy, genre, and marketing comment to draft campaign angles.',
        inputs: releaseDna.moodSignals.concat(releaseDna.genreSignals).slice(0, 8),
      }],
      approvalGates: [],
      assumptions: input.audioProfile ? ['Audio intelligence profile was supplied by the upload flow.'] : ['Audio analysis was not supplied; Song DNA is metadata-derived until analysis runs.'],
      confidence: releaseDna.confidence,
      output: {
        releaseDna,
        metadataDraft: releaseResult.metadataDraft,
        aiDisclosure: metadata.aiGeneratedContent,
      },
    });

    const distributionRun = createHarnessRun<DistributionDdexHarnessOutput>({
      userId: input.userId,
      projectId: input.projectId,
      domain: 'distribution_ddex',
      inputRefs: this.buildInputRefs(input, metadata),
      scores: [{
        label: 'DDEX Readiness',
        value: distributionReadiness.ddexPackageReady ? 100 : distributionReadiness.metadataComplete ? 70 : 35,
        max: 100,
        status: distributionReadiness.ddexPackageReady ? 'good' : distributionReadiness.metadataComplete ? 'watch' : 'blocked',
        rationale: distributionReadiness.ddexPackageReady ? 'Metadata, identifiers, and DPID are present.' : 'Release is missing metadata, identifiers, rights, or storefront readiness fields.',
      }],
      findings: [
        ...distributionReadiness.missingFields.map((field, index) => ({
          id: `missing_distribution_field_${index}`,
          domain: 'distribution_ddex' as const,
          severity: 'high' as const,
          title: `Missing ${field}`,
          detail: `${field} is required before direct-to-storefront delivery.`,
          confidence: 'high' as const,
        })),
        ...distributionReadiness.rightsWarnings.map((warning, index) => ({
          id: `distribution_rights_warning_${index}`,
          domain: 'distribution_ddex' as const,
          severity: 'high' as const,
          title: 'Rights warning',
          detail: warning,
          confidence: 'high' as const,
        })),
      ],
      recommendations: [{
        id: 'complete_ddex_readiness',
        domain: 'distribution_ddex',
        priority: distributionReadiness.ddexPackageReady ? 'low' : 'high',
        title: distributionReadiness.ddexPackageReady ? 'Hold for user delivery approval' : 'Complete DDEX readiness blockers',
        detail: distributionReadiness.ddexPackageReady
          ? 'The package can be prepared, but delivery remains blocked until explicit user approval.'
          : 'Resolve missing identifiers, metadata, rights, and storefront requirements before delivery.',
        ownerAgentId: 'distribution',
        approvalRequired: true,
        nextAction: distributionReadiness.ddexPackageReady ? 'Ask user for delivery approval.' : 'Open release metadata and identifier checklist.',
      }],
      costLines: [],
      legalBasis: [],
      evidenceRefs: creatorProtectionRun.evidenceRefs,
      agentBriefs: [{
        agentId: 'distribution',
        departmentId: 'distribution',
        brief: 'Prepare DDEX package readiness, identifier checklist, territory/storefront blockers, and no-delivery approval gate.',
        inputs: distributionReadiness.missingFields,
        blockedBy: distributionReadiness.ddexPackageReady ? ['User delivery approval required'] : distributionReadiness.missingFields,
      }, {
        agentId: 'legal',
        departmentId: 'legal',
        brief: 'Review rights warnings, samples, covers, AI disclosure, and direct storefront delivery risks.',
        inputs: distributionReadiness.rightsWarnings,
      }],
      approvalGates: [{
        id: 'ddex_delivery_user_approval',
        label: 'Direct storefront delivery approval',
        reason: 'DDEX delivery is irreversible or externally visible and must be approved by the user.',
        requiredFor: 'deliver release package to DSP/storefront',
        riskTier: 'approval',
      }],
      assumptions: ['DDEX delivery is never authorized by this harness. It only prepares readiness.'],
      confidence: distributionReadiness.ddexPackageReady ? 0.9 : distributionReadiness.metadataComplete ? 0.65 : 0.42,
      output: { readiness: distributionReadiness },
    });

    const savedRunIds = input.save ? {
      songDna: await saveHarnessRun(songDnaRun),
      distribution: await saveHarnessRun(distributionRun),
      creatorProtection: await saveHarnessRun(creatorProtectionRun),
      release: await saveReleaseHarnessRun(releaseResult),
    } : undefined;

    return {
      songDnaRun,
      distributionRun,
      creatorProtectionRun,
      releaseResult,
      savedRunIds,
    };
  }

  private createDefaultProtectionProfile(params: {
    userId: string;
    userProfile?: UserProfile;
    metadata: Partial<ExtendedGoldenMetadata>;
  }): IdentityProtectionProfile {
    return creatorProtectionHarnessService.createIdentityProtectionProfile({
      userId: params.userId,
      legalName: params.metadata.composerName,
      artistName: params.metadata.artistName ?? params.userProfile?.displayName ?? undefined,
      country: 'US',
      labelName: params.metadata.labelName,
      publisherName: params.metadata.publisherName ?? params.metadata.publisher,
      pro: params.metadata.pro,
      ipiCae: params.metadata.composerIPI,
      copyrightStatus: params.metadata.isrc || params.metadata.upc ? 'draft' : 'unknown',
      trademarkStatus: 'unknown',
      aiVoiceLikenessPermission: 'not_authorized',
      monitoringOptIn: false,
      biometricFingerprintOptIn: false,
    });
  }

  private buildInputRefs(input: UploadIntakeHarnessInput, metadata: Partial<ExtendedGoldenMetadata>) {
    return [
      { type: 'user' as const, id: input.userId, label: metadata.artistName ?? input.userProfile?.displayName ?? 'Artist' },
      ...(input.projectId ? [{ type: 'project' as const, id: input.projectId }] : []),
      ...(input.trackId ? [{ type: 'track' as const, id: input.trackId, label: metadata.trackTitle }] : []),
      ...(metadata.isrc ? [{ type: 'track' as const, id: metadata.isrc, label: 'ISRC' }] : []),
      ...(metadata.upc ? [{ type: 'release' as const, id: metadata.upc, label: 'UPC' }] : []),
    ];
  }
}

export const uploadIntakeHarnessService = new UploadIntakeHarnessService();
