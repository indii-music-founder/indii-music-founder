import { getDocs, collection, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { UserProfile } from '@/types/User';
import type { ArtistOperatingModel, DistributionReadiness, ReleaseDna } from './types';
import { IdentifierService } from '@/services/identity/IdentifierService';

export async function analyzeMasterForHarness(file?: File, profile?: AudioIntelligenceProfile): Promise<AudioIntelligenceProfile | undefined> {
  if (profile) return profile;
  if (!file) return undefined;
  return audioIntelligence.analyze(file);
}

export function buildReleaseDna(audioProfile?: AudioIntelligenceProfile, metadata?: Partial<ExtendedGoldenMetadata>): ReleaseDna {
  const technical = audioProfile?.technical;
  const semantic = audioProfile?.semantic;
  const energy = clamp01(technical?.energy ?? metadata?.energy ?? 0.5);
  const danceability = clamp01(technical?.danceability ?? 0.5);
  const isInstrumental = semantic?.language === 'zxx' || metadata?.isInstrumental === true;
  const genreSignals = compact([...(semantic?.genre ?? []), semantic?.ddexGenre, metadata?.genre, metadata?.subGenre]);
  const moodSignals = compact([...(semantic?.mood ?? []), ...(metadata?.mood ?? [])]);

  return {
    fingerprint: audioProfile?.id ?? metadata?.masterFingerprint,
    genreSignals,
    moodSignals,
    energy,
    tempo: technical?.bpm ?? metadata?.bpm,
    key: technical?.key ?? metadata?.key,
    vocalPresence: isInstrumental ? 'instrumental' : 'prominent',
    commercialFit: {
      shortForm: clamp01((energy * 0.45) + (danceability * 0.35) + (moodSignals.length > 0 ? 0.15 : 0.05)),
      playlist: clamp01((semantic?.marketingComment ? 0.25 : 0.1) + (genreSignals.length > 0 ? 0.25 : 0.1) + ((1 - Math.abs(energy - 0.55)) * 0.4)),
      sync: clamp01((isInstrumental ? 0.25 : 0.1) + ((1 - Math.abs(energy - 0.45)) * 0.45) + (semantic?.visualImagery ? 0.2 : 0.05)),
      club: clamp01((danceability * 0.5) + (energy * 0.35) + ((technical?.bpm ?? 0) >= 115 ? 0.15 : 0)),
      editorial: clamp01((semantic?.marketingComment ? 0.35 : 0.1) + (genreSignals.length > 1 ? 0.25 : 0.1) + (moodSignals.length > 1 ? 0.2 : 0.05)),
    },
    metadataSuggestions: {
      title: metadata?.trackTitle,
      genre: semantic?.ddexGenre ?? metadata?.genre,
      subgenre: semantic?.ddexSubGenre ?? metadata?.subGenre,
      mood: moodSignals,
      language: semantic?.language ?? metadata?.language,
      explicit: semantic?.isExplicit ?? metadata?.explicit,
      marketingComment: semantic?.marketingComment ?? metadata?.marketingComment,
    },
    confidence: audioProfile ? 0.88 : metadata ? 0.48 : 0.25,
  };
}

export async function buildArtistOperatingModel(params: {
  userId: string;
  userProfile?: UserProfile;
  analyticsReports?: Record<string, unknown>;
}): Promise<ArtistOperatingModel> {
  const { userId, userProfile, analyticsReports = {} } = params;
  const goals = userProfile?.goals ?? [];
  const brandKit = userProfile?.brandKit;
  const preferredChannels = compact([
    brandKit?.socials?.tiktok ? 'tiktok' : undefined,
    brandKit?.socials?.instagram ? 'instagram' : undefined,
    brandKit?.socials?.youtube ? 'youtube' : undefined,
    brandKit?.socials?.spotify ? 'spotify' : undefined,
    brandKit?.socials?.bandcamp ? 'bandcamp' : undefined,
    brandKit?.socials?.beatport ? 'beatport' : undefined,
  ]);
  const careerMemories = await fetchCareerMemorySummaries(userId);
  const distributionMemories = await fetchVaultFacts(userId, 'distribution');
  const preferenceFacts = await fetchVaultFacts(userId, 'preferences');
  const analyticsSignals = Object.keys(analyticsReports).slice(0, 5);
  const lowerGoals = goals.join(' ').toLowerCase();
  const lowerBrand = `${brandKit?.brandDescription ?? ''} ${brandKit?.targetAudience ?? ''}`.toLowerCase();

  const model: ArtistOperatingModel = {
    identity: {
      artistName: userProfile?.displayName ?? undefined,
      brandDescription: brandKit?.brandDescription,
      careerStage: userProfile?.careerStage,
      goals,
      aesthetic: brandKit?.aestheticStyle ?? brandKit?.visualIdentity,
      distributor: brandKit?.socials?.distributor,
    },
    preferences: {
      communicationStyle: String(userProfile?.preferences?.communicationStyle ?? ''),
      workCadence: preferenceFacts.find(f => /cadence|schedule|workflow/i.test(f)),
      riskTolerance: inferRiskTolerance(lowerGoals, lowerBrand),
      budgetBehavior: preferenceFacts.find(f => /budget|spend|cost|finance/i.test(f)),
      preferredChannels: preferredChannels.length ? preferredChannels : ['spotify'],
    },
    history: {
      successfulReleasePatterns: compact([
        analyticsSignals.length ? `Analytics available for ${analyticsSignals.length} track(s)` : undefined,
        ...careerMemories.filter(m => /milestone|viral|stream|playlist|sold|tour|sync/i.test(m)).slice(0, 4),
      ]),
      weakSpots: compact([
        goals.length === 0 ? 'No explicit career goals captured yet' : undefined,
        preferredChannels.length === 0 ? 'No connected social/storefront channels in profile' : undefined,
      ]),
      priorCampaignSignals: careerMemories.filter(m => /campaign|marketing|content|press|playlist/i.test(m)).slice(0, 5),
      priorDistributionIssues: distributionMemories.filter(m => /issue|blocked|reject|missing|takedown|delivery/i.test(m)).slice(0, 5),
      importantCareerMemories: careerMemories.slice(0, 6),
    },
    confidence: clamp01(
      0.2 +
      (userProfile?.displayName ? 0.1 : 0) +
      (brandKit?.brandDescription ? 0.15 : 0) +
      (goals.length ? 0.15 : 0) +
      (preferredChannels.length ? 0.1 : 0) +
      (careerMemories.length ? 0.2 : 0) +
      (Object.keys(analyticsReports).length ? 0.1 : 0)
    ),
  };

  return model;
}

export function buildDistributionReadiness(params: {
  metadata?: Partial<ExtendedGoldenMetadata>;
  selectedStores?: string[];
}): DistributionReadiness {
  const metadata = params.metadata ?? {};
  const selectedStores = params.selectedStores ?? [];
  const required: Array<[keyof ExtendedGoldenMetadata, string]> = [
    ['trackTitle', 'Track title'],
    ['artistName', 'Artist name'],
    ['genre', 'Genre'],
    ['labelName', 'Label name'],
    ['releaseDate', 'Release date'],
    ['territories', 'Territories'],
    ['distributionChannels', 'Distribution channels'],
  ];
  const missingFields = required
    .filter(([key]) => {
      const value = metadata[key];
      return Array.isArray(value) ? value.length === 0 : !value;
    })
    .map(([, label]) => label);
  const rightsWarnings = compact([
    metadata.isrc && !IdentifierService.validateISRC(metadata.isrc) ? 'ISRC format is invalid' : undefined,
    metadata.upc && !IdentifierService.validateUPC(metadata.upc) ? 'UPC format is invalid' : undefined,
    metadata.iswc && !IdentifierService.validateISWC(metadata.iswc) ? 'ISWC format is invalid' : undefined,
    metadata.splits && metadata.splits.reduce((sum, split) => sum + split.percentage, 0) !== 100 ? 'Royalty splits do not total 100%' : undefined,
    metadata.containsSamples && !metadata.samples?.every(sample => sample.cleared) ? 'Samples need clearance before delivery' : undefined,
    metadata.isCoverSong ? 'Cover song needs mechanical license verification' : undefined,
  ]);
  const missingIdentifiers: Array<'isrc' | 'upc' | 'iswc' | 'catalogNumber'> = [
    !metadata.isrc ? 'isrc' : undefined,
    !metadata.upc ? 'upc' : undefined,
    !metadata.iswc ? 'iswc' : undefined,
    !metadata.catalogNumber ? 'catalogNumber' : undefined,
  ].filter((value): value is 'isrc' | 'upc' | 'iswc' | 'catalogNumber' => Boolean(value));
  const metadataComplete = missingFields.length === 0 && rightsWarnings.length === 0;
  const ddexPackageReady = metadataComplete && Boolean(metadata.dpid) && missingIdentifiers.length === 0;

  return {
    metadataComplete,
    ddexPackageReady,
    identifiers: {
      isrc: metadata.isrc,
      upc: metadata.upc,
      iswc: metadata.iswc,
      iswcStatus: metadata.iswc ? 'registered' : 'missing',
      catalogNumber: metadata.catalogNumber,
      missing: missingIdentifiers,
    },
    connectedStores: selectedStores,
    blockedStores: metadataComplete ? [] : selectedStores,
    missingFields: [
      ...missingFields,
      ...missingIdentifiers.map(identifier => identifier.toUpperCase()),
    ],
    rightsWarnings,
    authorityLevel: ddexPackageReady && selectedStores.length > 0 ? 'package_ready' : metadataComplete ? 'metadata_only' : 'metadata_only',
  };
}

async function fetchCareerMemorySummaries(userId: string): Promise<string[]> {
  try {
    const q = query(
      collection(db, 'career_memory_archive'),
      where('userId', '==', userId),
      orderBy('eventDate', 'desc'),
      limit(12)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => String(doc.data().content ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchVaultFacts(userId: string, category: string): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'vault'));
    const doc = snap.docs.find(d => d.id === category);
    const items = (doc?.data().items ?? []) as Array<{ fact?: string; status?: string }>;
    return items.filter(item => item.status !== 'superseded' && item.fact).map(item => item.fact!);
  } catch {
    return [];
  }
}

function inferRiskTolerance(goals: string, brand: string): 'low' | 'medium' | 'high' {
  if (/viral|tour|growth|brand|aggressive|label/.test(goals) || /bold|punk|high energy|disrupt/.test(brand)) return 'high';
  if (/sync|licensing|catalog|stability|publishing/.test(goals)) return 'low';
  return 'medium';
}

function compact(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
