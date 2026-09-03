import {
  NormalizedStatementReport,
  ArtistBusinessGraphResolution,
  GraphNormalizedRelease,
  GraphContributorAllocation,
  CatalogMetadataLookup,
} from './types.js';
import { DecimalMoney } from './DecimalMoney.js';

export class ArtistBusinessGraphNormalizer {
  /**
   * Resolve normalized statement transactions against the canonical Artist Business Graph
   * using DecimalMoney exact arithmetic (BigInt 6-decimal micro-units).
   */
  static normalizeToGraph(
    report: NormalizedStatementReport,
    catalog: Map<string, CatalogMetadataLookup>
  ): ArtistBusinessGraphResolution {
    const releaseMap = new Map<string, GraphNormalizedRelease>();
    const releaseGrossMap = new Map<string, DecimalMoney>();
    const releaseNetMap = new Map<string, DecimalMoney>();
    const trackGrossMap = new Map<string, DecimalMoney>();
    const trackNetMap = new Map<string, DecimalMoney>();
    const trackAllocMap = new Map<string, DecimalMoney>(); // key: `${trackKey}:${contributorName}`

    const unmatchedIsrcs = new Set<string>();
    const unmatchedUpcs = new Set<string>();
    const contributorTotals: Record<string, { totalPayout: number; currency: string }> = {};
    const contributorPayoutMoney: Record<string, DecimalMoney> = {};

    let totalAllocatedMoney = DecimalMoney.zero();
    let lineageLinksCount = 0;

    for (const txn of report.transactions) {
      const isrc = txn.isrc;
      const upc = txn.upc;

      let metadata: CatalogMetadataLookup | undefined;
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
        releaseGrossMap.set(releaseKey, DecimalMoney.zero());
        releaseNetMap.set(releaseKey, DecimalMoney.zero());
      }

      const txnGross = DecimalMoney.fromFloat(txn.grossRevenue);
      const txnNet = DecimalMoney.fromFloat(txn.netRevenue);

      const curReleaseGross = releaseGrossMap.get(releaseKey)!.add(txnGross);
      const curReleaseNet = releaseNetMap.get(releaseKey)!.add(txnNet);
      releaseGrossMap.set(releaseKey, curReleaseGross);
      releaseNetMap.set(releaseKey, curReleaseNet);

      release.totalGrossRevenue = curReleaseGross.toFloat();
      release.totalNetRevenue = curReleaseNet.toFloat();

      if (txn.transactionType === 'stream') {
        release.totalStreams += txn.quantity;
      }

      // Track-level allocation
      let track = release.tracks.find((t) => t.isrc === isrc);
      const trackKey = isrc || `${releaseKey}-UNKNOWN`;

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
        trackGrossMap.set(trackKey, DecimalMoney.zero());
        trackNetMap.set(trackKey, DecimalMoney.zero());
        for (const alloc of allocations) {
          trackAllocMap.set(`${trackKey}:${alloc.contributorName}`, DecimalMoney.zero());
        }
      }

      const curTrackGross = trackGrossMap.get(trackKey)!.add(txnGross);
      const curTrackNet = trackNetMap.get(trackKey)!.add(txnNet);
      trackGrossMap.set(trackKey, curTrackGross);
      trackNetMap.set(trackKey, curTrackNet);

      track.grossRevenue = curTrackGross.toFloat();
      track.netRevenue = curTrackNet.toFloat();

      if (txn.transactionType === 'stream') track.streams += txn.quantity;
      if (txn.transactionType === 'download') track.downloads += txn.quantity;

      track.sourceLineIndices.push(txn.sourceLineIndex);
      lineageLinksCount++;

      // Distribute net revenue according to contributor split percentages
      for (const alloc of track.contributorAllocations) {
        const shareMoney = txnNet.multiply(alloc.sharePercentage / 100);
        const allocKey = `${trackKey}:${alloc.contributorName}`;
        const curAllocMoney = (trackAllocMap.get(allocKey) || DecimalMoney.zero()).add(shareMoney);
        trackAllocMap.set(allocKey, curAllocMoney);
        alloc.allocatedAmount = curAllocMoney.toFloat();

        totalAllocatedMoney = totalAllocatedMoney.add(shareMoney);

        if (!contributorPayoutMoney[alloc.contributorName]) {
          contributorPayoutMoney[alloc.contributorName] = DecimalMoney.zero();
          contributorTotals[alloc.contributorName] = { totalPayout: 0, currency: txn.currency };
        }
        contributorPayoutMoney[alloc.contributorName] = contributorPayoutMoney[alloc.contributorName]!.add(shareMoney);
        contributorTotals[alloc.contributorName]!.totalPayout = contributorPayoutMoney[alloc.contributorName]!.toFloat();
      }
    }

    return {
      releases: Array.from(releaseMap.values()),
      unmatchedIsrcs: Array.from(unmatchedIsrcs),
      unmatchedUpcs: Array.from(unmatchedUpcs),
      totalAllocatedRevenue: totalAllocatedMoney.toFloat(),
      contributorSummary: contributorTotals,
      lineageLinksCount,
    };
  }
}
