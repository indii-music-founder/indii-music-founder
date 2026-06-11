import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { ReleaseHarnessInput, ReleaseHarnessResult } from './types';
import {
  analyzeMasterForHarness,
  buildArtistOperatingModel,
  buildDistributionReadiness,
  buildReleaseDna,
} from './ReleaseHarnessAdapters';
import { buildAgentBriefs, buildTimelineDraft, scoreStrategies } from './ReleaseHarnessScoring';

export class ReleaseHarnessService {
  async compileReleaseHarness(input: ReleaseHarnessInput): Promise<ReleaseHarnessResult> {
    const audioProfile = await analyzeMasterForHarness(input.audioFile, input.audioProfile);
    const releaseDna = buildReleaseDna(audioProfile, input.metadata);
    const artistOperatingModel = await buildArtistOperatingModel({
      userId: input.userId,
      userProfile: input.userProfile,
      analyticsReports: input.analyticsReports,
    });
    const distributionReadiness = buildDistributionReadiness({
      metadata: input.metadata,
      selectedStores: input.selectedStores,
    });
    const strategyAlternatives = scoreStrategies({
      releaseDna,
      artist: artistOperatingModel,
      distribution: distributionReadiness,
      primaryGoal: input.releaseIntent?.primaryGoal,
    });
    const recommendedStrategy = strategyAlternatives[0]!;
    const metadataDraft = buildMetadataDraft(input.metadata, releaseDna, input.releaseIntent);
    const warnings = [
      ...distributionReadiness.missingFields.map(field => `Missing DDEX metadata: ${field}`),
      ...distributionReadiness.rightsWarnings,
      ...(distributionReadiness.identifiers.missing.length
        ? [`Identifier assignment needed: ${distributionReadiness.identifiers.missing.map(id => id.toUpperCase()).join(', ')}`]
        : []),
      ...(distributionReadiness.authorityLevel !== 'delivery_authorized'
        ? ['Storefront delivery is not authorized by this harness run; this is package/readiness output only.']
        : []),
    ];
    const assumptions = [
      ...(audioProfile ? [] : ['No fresh audio analysis was available, so song DNA used metadata fallbacks.']),
      ...(artistOperatingModel.confidence < 0.5 ? ['Artist memory is sparse; recommendation is weighted toward catalog foundation and metadata quality.'] : []),
      ...(input.releaseIntent?.targetDate ? [] : ['No target date supplied; timeline is relative to release day.']),
    ];

    return {
      runId: `harness_${Date.now()}`,
      userId: input.userId,
      projectId: input.projectId,
      trackId: input.trackId ?? audioProfile?.id,
      createdAt: new Date().toISOString(),
      releaseDna,
      artistOperatingModel,
      distributionReadiness,
      recommendedStrategy,
      strategyAlternatives: strategyAlternatives.slice(1),
      timelineDraft: buildTimelineDraft(recommendedStrategy, distributionReadiness),
      agentBriefs: buildAgentBriefs(recommendedStrategy, distributionReadiness, releaseDna),
      metadataDraft,
      assumptions,
      warnings,
      confidence: round((releaseDna.confidence + artistOperatingModel.confidence + (distributionReadiness.metadataComplete ? 0.8 : 0.35)) / 3),
    };
  }
}

export const releaseHarnessService = new ReleaseHarnessService();

function buildMetadataDraft(
  metadata: Partial<ExtendedGoldenMetadata> = {},
  releaseDna: ReleaseHarnessResult['releaseDna'],
  intent?: ReleaseHarnessInput['releaseIntent']
): Partial<ExtendedGoldenMetadata> {
  return {
    ...metadata,
    trackTitle: metadata.trackTitle || intent?.title || releaseDna.metadataSuggestions.title || '',
    genre: metadata.genre || releaseDna.metadataSuggestions.genre || '',
    subGenre: metadata.subGenre || releaseDna.metadataSuggestions.subgenre,
    mood: metadata.mood?.length ? metadata.mood : releaseDna.metadataSuggestions.mood,
    language: metadata.language || releaseDna.metadataSuggestions.language,
    explicit: metadata.explicit ?? releaseDna.metadataSuggestions.explicit ?? false,
    marketingComment: metadata.marketingComment || releaseDna.metadataSuggestions.marketingComment,
    bpm: metadata.bpm || releaseDna.tempo,
    key: metadata.key || releaseDna.key,
    energy: metadata.energy ?? releaseDna.energy,
    catalogNumber: metadata.catalogNumber || buildCatalogNumber(metadata.artistName, metadata.trackTitle || intent?.title),
    releaseType: metadata.releaseType || (intent?.releaseType ? titleCaseReleaseType(intent.releaseType) : undefined),
  };
}

function titleCaseReleaseType(type: 'single' | 'ep' | 'album'): 'Single' | 'EP' | 'Album' {
  if (type === 'ep') return 'EP';
  if (type === 'album') return 'Album';
  return 'Single';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCatalogNumber(artistName?: string, title?: string): string | undefined {
  if (!artistName || !title) return undefined;
  const seed = `${artistName} ${title}`
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.slice(0, 3))
    .join('')
    .slice(0, 10);
  if (!seed) return undefined;
  return `IND-${seed}-${new Date().getFullYear()}`;
}
