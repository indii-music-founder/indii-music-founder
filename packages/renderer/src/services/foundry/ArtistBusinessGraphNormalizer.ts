import {
  NormalizedStatementReport,
  ArtistBusinessGraphResolution,
  GraphNormalizedRelease,
  GraphContributorAllocation
} from '@indii/shared';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

export class ArtistBusinessGraphNormalizer {
  /**
   * Resolve normalized statement transactions against the canonical Artist Business Graph
   */
  static normalizeToGraph(
    report: NormalizedStatementReport,
    catalog: Map<string, ExtendedGoldenMetadata>
  ): ArtistBusinessGraphResolution {
    const releaseMap = new Map<string, GraphNormalizedRelease>();
    const unmatchedIsrcs = new Set<string>();
    const unmatchedUpcs = new Set<string>();
    const contributorTotals: Record<string, { totalPayout: number; currency: string }> = {};

    let totalAllocatedRevenue = 0;
    let lineageLinksCount = 0;

    for (const txn of report.transactions) {
      const isrc = txn.isrc;
      const upc = txn.upc;

      let metadata: ExtendedGoldenMetadata | undefined;
      if (isrc && catalog.has(isrc)) {
        metadata = catalog.get(isrc);
      } else if (upc && catalog.has(upc)) {
        metadata = catalog.get(upc);
      }

      if (!metadata) {
        if (isrc) unmatchedIsrcs.add(isrc);
        if (upc) unmatchedUpcs.add(upc);
        continue;
      }

      const releaseKey = metadata.upc || txn.upc || 'UNKNOWN_RELEASE';
      let release = releaseMap.get(releaseKey);
      if (!release) {
        release = {
          upc: releaseKey,
          title: metadata.trackTitle || txn.albumTitle || txn.trackTitle,
          artist: metadata.artistName || txn.artistName,
          totalGrossRevenue: 0,
          totalNetRevenue: 0,
          totalStreams: 0,
          tracks: [],
        };
        releaseMap.set(releaseKey, release);
      }

      release.totalGrossRevenue = Math.round((release.totalGrossRevenue + txn.grossRevenue) * 100) / 100;
      release.totalNetRevenue = Math.round((release.totalNetRevenue + txn.netRevenue) * 100) / 100;
      if (txn.transactionType === 'stream') {
        release.totalStreams += txn.quantity;
      }

      // Track-level allocation
      let track = release.tracks.find((t) => t.isrc === isrc);
      if (!track) {
        // Calculate contributor allocations from metadata.splits
        const splits = metadata.splits || [];
        const allocations: GraphContributorAllocation[] = splits.map((s) => ({
          contributorName: s.legalName || 'Unknown Contributor',
          role: s.role || 'other',
          sharePercentage: s.percentage,
          allocatedAmount: 0,
          currency: txn.currency,
        }));

        track = {
          isrc: isrc || 'UNKNOWN_ISRC',
          title: metadata.trackTitle || txn.trackTitle,
          artist: metadata.artistName || txn.artistName,
          grossRevenue: 0,
          netRevenue: 0,
          streams: 0,
          downloads: 0,
          contributorAllocations: allocations,
          sourceLineIndices: [],
        };
        release.tracks.push(track);
      }

      track.grossRevenue = Math.round((track.grossRevenue + txn.grossRevenue) * 100) / 100;
      track.netRevenue = Math.round((track.netRevenue + txn.netRevenue) * 100) / 100;
      if (txn.transactionType === 'stream') track.streams += txn.quantity;
      if (txn.transactionType === 'download') track.downloads += txn.quantity;

      track.sourceLineIndices.push(txn.sourceLineIndex);
      lineageLinksCount++;

      // Distribute net revenue according to contributor split percentages
      for (const alloc of track.contributorAllocations) {
        const shareAmount = Math.round((txn.netRevenue * (alloc.sharePercentage / 100)) * 100) / 100;
        alloc.allocatedAmount = Math.round((alloc.allocatedAmount + shareAmount) * 100) / 100;
        totalAllocatedRevenue = Math.round((totalAllocatedRevenue + shareAmount) * 100) / 100;

        if (!contributorTotals[alloc.contributorName]) {
          contributorTotals[alloc.contributorName] = { totalPayout: 0, currency: txn.currency };
        }
        contributorTotals[alloc.contributorName]!.totalPayout =
          Math.round((contributorTotals[alloc.contributorName]!.totalPayout + shareAmount) * 100) / 100;
      }
    }

    return {
      releases: Array.from(releaseMap.values()),
      unmatchedIsrcs: Array.from(unmatchedIsrcs),
      unmatchedUpcs: Array.from(unmatchedUpcs),
      totalAllocatedRevenue,
      contributorSummary: contributorTotals,
      lineageLinksCount,
    };
  }
}
