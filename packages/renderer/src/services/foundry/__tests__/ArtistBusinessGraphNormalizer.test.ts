import { describe, it, expect } from 'vitest';
import { ArtistBusinessGraphNormalizer } from '../ArtistBusinessGraphNormalizer';
import { DistroKidStatementAdapter } from '../adapters/DistroKidStatementAdapter';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('ArtistBusinessGraphNormalizer', () => {
  const sampleTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.00\tUS
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t3000\t25.00\tUS`;

  const mockCatalog = new Map<string, ExtendedGoldenMetadata>([
    [
      'US-IND-26-00001',
      {
        trackTitle: 'Velvet Voltage',
        artistName: 'KIRA NOVA',
        isrc: 'US-IND-26-00001',
        explicit: false,
        genre: 'Synthwave',
        labelName: 'indii Records',
        splits: [
          { legalName: 'Kira Novakowski', role: 'songwriter', percentage: 60, email: 'kira@example.com' },
          { legalName: 'DJ PHANTOM', role: 'producer', percentage: 40, email: 'phantom@example.com' },
        ],
        pro: 'BMI',
        publisher: 'indii Publishing',
      } as ExtendedGoldenMetadata,
    ],
  ]);

  it('should normalize statement into releases, tracks, and calculate contributor splits with line lineage', () => {
    const adapter = new DistroKidStatementAdapter();
    const report = adapter.parse(sampleTsv);

    const graph = ArtistBusinessGraphNormalizer.normalizeToGraph(report, mockCatalog);

    expect(graph.releases.length).toBe(1);
    expect(graph.unmatchedIsrcs.length).toBe(0);

    const release = graph.releases[0]!;
    expect(release.totalGrossRevenue).toBe(80.00);
    expect(release.totalNetRevenue).toBe(80.00);
    expect(release.totalStreams).toBe(17500);

    const track = release.tracks[0]!;
    expect(track.isrc).toBe('US-IND-26-00001');
    expect(track.grossRevenue).toBe(80.00);
    expect(track.sourceLineIndices).toEqual([2, 3]);

    // Check contributor splits: 60% of $80 = $48; 40% of $80 = $32
    expect(graph.contributorSummary['Kira Novakowski']?.totalPayout).toBe(48.00);
    expect(graph.contributorSummary['DJ PHANTOM']?.totalPayout).toBe(32.00);
    expect(graph.totalAllocatedRevenue).toBe(80.00);
    expect(graph.lineageLinksCount).toBe(2);
  });
});
