import type {
  ArtistOperatingModel,
  DistributionReadiness,
  HarnessAgentBrief,
  HarnessReleaseGoal,
  HarnessTimelineItem,
  ReleaseDna,
  ReleaseStrategy,
  ReleaseStrategyId,
} from './types';

const STRATEGY_NAMES: Record<ReleaseStrategyId, string> = {
  distribution_first_release: 'Distribution-First Release',
  short_form_algorithmic_push: 'Short-Form Algorithmic Push',
  playlist_ladder: 'Playlist Ladder',
  direct_fan_conversion: 'Direct Fan Conversion',
  sync_or_b2b_positioning: 'Sync / B2B Positioning',
  club_dj_or_scene_push: 'Club, DJ, Or Scene Push',
  catalog_foundation_release: 'Catalog Foundation Release',
};

export function scoreStrategies(params: {
  releaseDna: ReleaseDna;
  artist: ArtistOperatingModel;
  distribution: DistributionReadiness;
  primaryGoal?: HarnessReleaseGoal;
}): ReleaseStrategy[] {
  const { releaseDna, artist, distribution, primaryGoal } = params;
  const goalText = [...artist.identity.goals, primaryGoal ?? ''].join(' ').toLowerCase();
  const channels = artist.preferences.preferredChannels;
  const risk = artist.preferences.riskTolerance;
  const memoryBoost = artist.confidence * 10;
  const ddexBoost = distribution.ddexPackageReady ? 16 : distribution.metadataComplete ? 8 : -10;

  const candidates: ReleaseStrategy[] = [
    makeStrategy('distribution_first_release', 52 + ddexBoost + memoryBoost, 'Delivery readiness', [
      'Prioritize metadata, assets, rights, and store package readiness.',
      distribution.ddexPackageReady ? 'The release is close to package-ready.' : 'Distribution blockers should be cleared before the campaign expands.',
    ]),
    makeStrategy('short_form_algorithmic_push', 38 + releaseDna.commercialFit.shortForm * 38 + (channels.includes('tiktok') || channels.includes('instagram') ? 10 : 0) + (risk === 'high' ? 8 : 0), 'Short-form video', [
      'Song DNA supports repeatable short-form hooks.',
      'Artist memory indicates enough channel fit or risk tolerance for high-cadence content.',
    ]),
    makeStrategy('playlist_ladder', 36 + releaseDna.commercialFit.playlist * 35 + (goalText.includes('playlist') ? 12 : 0) + (channels.includes('spotify') ? 8 : 0), 'Playlist pitching', [
      'Metadata and sonic positioning can support staged playlist outreach.',
      'The plan should move from owned-context playlists to editorial-style positioning.',
    ]),
    makeStrategy('direct_fan_conversion', 34 + (goalText.includes('fan') || goalText.includes('sales') ? 14 : 0) + (channels.includes('bandcamp') ? 12 : 0) + memoryBoost, 'Owned audience', [
      'Artist context should drive the offer, not generic release promotion.',
      'Use the release to deepen direct fan capture and repeatable audience behavior.',
    ]),
    makeStrategy('sync_or_b2b_positioning', 30 + releaseDna.commercialFit.sync * 38 + (goalText.includes('sync') ? 16 : 0) + (risk === 'low' ? 6 : 0), 'Sync licensing', [
      'Song DNA and artist goals support a business-facing pitch angle.',
      'Rights and metadata must be clean before outreach.',
    ]),
    makeStrategy('club_dj_or_scene_push', 25 + releaseDna.commercialFit.club * 40 + (channels.includes('beatport') ? 14 : 0), 'Scene/DJ network', [
      'Tempo, energy, and platform context support a scene-led release route.',
      'Use targeted tastemakers before broad paid media.',
    ]),
    makeStrategy('catalog_foundation_release', 32 + (artist.confidence < 0.45 ? 16 : 0) + (distribution.metadataComplete ? 8 : 0), 'Catalog foundation', [
      'Use this release to build clean data, metadata, and repeatable operating history.',
      'This is the safest path when artist memory is still sparse.',
    ]),
  ];

  return candidates.sort((a, b) => b.score - a.score).map(strategy => ({
    ...strategy,
    score: Math.round(strategy.score),
  }));
}

export function buildTimelineDraft(strategy: ReleaseStrategy, distribution: DistributionReadiness): HarnessTimelineItem[] {
  const blocker = distribution.missingFields[0] ?? distribution.rightsWarnings[0];
  return [
    {
      offsetDays: -28,
      owner: 'distribution',
      title: blocker ? 'Clear release package blockers' : 'Lock DDEX release package',
      description: blocker ? `Resolve: ${blocker}` : 'Freeze metadata, splits, assets, territories, and storefront package data.',
    },
    {
      offsetDays: -21,
      owner: 'creative',
      title: 'Build strategy-native creative kit',
      description: `Create visual and copy assets for the ${strategy.primaryChannel} route.`,
    },
    {
      offsetDays: -14,
      owner: 'marketing',
      title: 'Start pre-release signal capture',
      description: 'Test the strongest hooks, audiences, and copy before release week.',
    },
    {
      offsetDays: -7,
      owner: 'artist',
      title: 'Confirm release-week cadence',
      description: "Lock the artist's posting, outreach, and approval schedule around the recommended strategy.",
    },
    {
      offsetDays: 0,
      owner: 'distribution',
      title: 'Release day verification',
      description: 'Verify storefront status, links, metadata display, and immediate fan routing.',
    },
    {
      offsetDays: 7,
      owner: 'finance',
      title: 'Review early ROI signals',
      description: 'Compare first-week performance against the harness assumptions and adjust spend.',
    },
  ];
}

export function buildAgentBriefs(strategy: ReleaseStrategy, distribution: DistributionReadiness, releaseDna: ReleaseDna): HarnessAgentBrief[] {
  return [
    {
      agentId: 'distribution',
      brief: `Prepare the release for ${strategy.name}. Treat DDEX/storefront package readiness as the source of truth.`,
      inputs: [...distribution.missingFields, ...distribution.rightsWarnings],
      blockedBy: distribution.ddexPackageReady ? undefined : [...distribution.missingFields, ...distribution.rightsWarnings],
    },
    {
      agentId: 'marketing',
      brief: `Draft the campaign around ${strategy.primaryChannel}.`,
      inputs: strategy.rationale,
    },
    {
      agentId: 'creative',
      brief: 'Create visuals and messaging from the song DNA and artist memory, not generic genre templates.',
      inputs: [...releaseDna.genreSignals, ...releaseDna.moodSignals].slice(0, 8),
    },
    {
      agentId: 'legal',
      brief: 'Review splits, samples, cover-song status, and rights warnings before delivery or outreach.',
      inputs: distribution.rightsWarnings,
      blockedBy: distribution.rightsWarnings.length ? distribution.rightsWarnings : undefined,
    },
    {
      agentId: 'finance',
      brief: 'Set budget guardrails and measure actual release performance against harness assumptions.',
      inputs: [`Strategy score: ${strategy.score}`],
    },
    {
      agentId: 'timeline',
      brief: 'Convert the harness timeline into a draft release plan with gated milestones.',
      inputs: strategy.nextTasks,
    },
  ];
}

function makeStrategy(id: ReleaseStrategyId, score: number, primaryChannel: string, rationale: string[]): ReleaseStrategy {
  return {
    id,
    name: STRATEGY_NAMES[id],
    score,
    primaryChannel,
    rationale,
    nextTasks: [
      'Save harness run',
      'Resolve package blockers',
      'Create timeline draft',
      'Create campaign brief draft',
    ],
  };
}
