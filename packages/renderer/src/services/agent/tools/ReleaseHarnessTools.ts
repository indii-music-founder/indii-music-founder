import { auth } from '@/services/firebase';
import { releaseHarnessService, getReleaseHarnessRun, saveReleaseHarnessRun } from '@/services/release-harness';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { IdentifierService } from '@/services/identity/IdentifierService';
import { ISWCService } from '@/services/publishing/ISWCService';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const ReleaseHarnessTools: Record<string, AnyToolFunction> = {
  compile_release_harness: wrapTool('compile_release_harness', async (args: {
    projectId?: string;
    trackId?: string;
    title?: string;
    artistName?: string;
    genre?: string;
    releaseDate?: string;
    selectedStores?: string[];
    primaryGoal?: 'grow_fanbase' | 'playlisting' | 'touring' | 'sync' | 'direct_sales' | 'brand_growth';
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const metadata: Partial<ExtendedGoldenMetadata> = {
      trackTitle: args.title,
      artistName: args.artistName,
      genre: args.genre,
      releaseDate: args.releaseDate,
      labelName: 'indii.music',
      territories: ['Worldwide'],
      distributionChannels: ['streaming', 'download'],
      aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false },
    };

    const result = await releaseHarnessService.compileReleaseHarness({
      userId,
      projectId: args.projectId,
      trackId: args.trackId,
      metadata,
      selectedStores: args.selectedStores ?? [],
      releaseIntent: {
        title: args.title,
        primaryGoal: args.primaryGoal,
      },
    });

    const savedRunId = args.save ? await saveReleaseHarnessRun(result) : undefined;
    return toolSuccess({ ...result, savedRunId }, 'Release harness compiled. No store delivery was initiated.');
  }),

  get_release_harness_run: wrapTool('get_release_harness_run', async (args: {
    runId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const result = await getReleaseHarnessRun({ userId, runId: args.runId, projectId: args.projectId });
    if (!result) return toolError('Harness run not found', 'NOT_FOUND');
    return toolSuccess(result, 'Harness run loaded.');
  }),

  create_timeline_from_harness: wrapTool('create_timeline_from_harness', async (args: {
    runId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const result = await getReleaseHarnessRun({ userId, runId: args.runId, projectId: args.projectId });
    if (!result) return toolError('Harness run not found', 'NOT_FOUND');
    return toolSuccess({
      projectId: args.projectId,
      runId: args.runId,
      timelineDraft: result.timelineDraft,
    }, 'Timeline draft created from harness output. It has not been activated.');
  }),

  create_campaign_from_harness: wrapTool('create_campaign_from_harness', async (args: {
    runId: string;
    projectId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const result = await getReleaseHarnessRun({ userId, runId: args.runId, projectId: args.projectId });
    if (!result) return toolError('Harness run not found', 'NOT_FOUND');
    return toolSuccess({
      campaignName: result.recommendedStrategy.name,
      primaryChannel: result.recommendedStrategy.primaryChannel,
      rationale: result.recommendedStrategy.rationale,
      tasks: result.recommendedStrategy.nextTasks,
    }, 'Campaign brief draft created from harness output. It has not been launched.');
  }),

  generate_release_identifiers: wrapTool('generate_release_identifiers', async (args: {
    title?: string;
    artistName?: string;
    needsIsrc?: boolean;
    needsUpc?: boolean;
    needsIswcWorkDraft?: boolean;
    needsCatalogNumber?: boolean;
  }) => {
    const identifiers: { isrc?: string; upc?: string; catalogNumber?: string; iswcWorkId?: string; iswcStatus?: string } = {};
    if (args.needsIsrc !== false) identifiers.isrc = await IdentifierService.nextISRC();
    if (args.needsUpc !== false) identifiers.upc = await IdentifierService.nextUPC();
    if (args.needsCatalogNumber !== false) identifiers.catalogNumber = buildCatalogNumber(args.artistName, args.title);
    if (args.needsIswcWorkDraft !== false && args.title) {
      const work = await ISWCService.registerWork({
        title: args.title,
        composers: [{ name: args.artistName ?? 'Unknown Writer', share: 100, role: 'CA' }],
        associatedISRCs: identifiers.isrc ? [identifiers.isrc] : [],
        isInstrumental: false,
      });
      identifiers.iswcWorkId = work.id;
      identifiers.iswcStatus = work.status;
    }
    return toolSuccess(identifiers, 'Release identifiers generated and ISWC work draft prepared when requested. No official ISWC was fabricated and no store delivery was initiated.');
  }),
};

function buildCatalogNumber(artistName?: string, title?: string): string {
  const seed = `${artistName ?? 'INDII'} ${title ?? 'RELEASE'}`
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.slice(0, 3))
    .join('')
    .slice(0, 10);
  return `IND-${seed || 'REL'}-${new Date().getFullYear()}`;
}
