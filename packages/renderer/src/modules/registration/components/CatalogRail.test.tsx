import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExistingCatalogIntelligenceService } from '@/services/ingestion/ExistingCatalogIntelligenceService';
import { CatalogRail } from './CatalogRail';
import type { CatalogTrack } from '../types';

const now = '2026-09-22T12:00:00.000Z';

describe('CatalogRail catalog intelligence', () => {
  it('shows potential legacy identifier conflicts as review-only and names unassessed dimensions', () => {
    const track = (id: string): CatalogTrack => ({
      id,
      title: `Track ${id}`,
      artistName: 'Artist',
      writersAndContributors: [],
      isrc: 'USAAA2600001',
      isPublished: false,
    });
    const report = new ExistingCatalogIntelligenceService().analyzeRegistrationCatalog(
      'legacy-catalog:user-1', [track('legacy-a'), track('legacy-b')], now,
    );

    render(<CatalogRail
      tracks={[track('legacy-a'), track('legacy-b')]}
      selectedTrackId={null}
      registrationStates={{}}
      intelligenceReport={report}
      canonicalIntelligenceReport={null}
      canonicalIntelligenceStatus="unavailable"
      onSelectTrack={vi.fn()}
    />);

    expect(screen.getByRole('region', { name: 'Catalog intelligence' })).toBeInTheDocument();
    expect(screen.getByText('1 potential identifier conflict needs review.')).toBeInTheDocument();
    expect(screen.getByText(/Legacy details are unconfirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/ownership confirmed|registration complete/i)).not.toBeInTheDocument();
  });

  it('does not imply complete legacy coverage when no collision is observed', () => {
    const track: CatalogTrack = {
      id: 'legacy-1',
      title: 'Legacy Track',
      artistName: 'Artist',
      writersAndContributors: [],
      isPublished: false,
    };
    const report = new ExistingCatalogIntelligenceService().analyzeRegistrationCatalog(
      'legacy-catalog:user-1', [track], now,
    );

    render(<CatalogRail
      tracks={[track]}
      selectedTrackId={null}
      registrationStates={{}}
      intelligenceReport={report}
      canonicalIntelligenceReport={null}
      canonicalIntelligenceStatus="unavailable"
      onSelectTrack={vi.fn()}
    />);

    expect(screen.getByText('No identifier collisions were observed in the available legacy projection; coverage is not verified.')).toBeInTheDocument();
  });

  it('keeps canonical scan truth separate and does not claim legacy catalog coverage', () => {
    const track: CatalogTrack = {
      id: 'legacy-1',
      title: 'Legacy Track',
      artistName: 'Artist',
      writersAndContributors: [],
      isPublished: false,
    };
    const canonicalReport = new ExistingCatalogIntelligenceService().analyzeRegistrationCatalog(
      'canonical:user-1', [], now,
    );

    render(<CatalogRail
      tracks={[track]}
      selectedTrackId={null}
      registrationStates={{}}
      intelligenceReport={null}
      canonicalIntelligenceReport={canonicalReport}
      canonicalIntelligenceStatus="ready"
      onSelectTrack={vi.fn()}
    />);

    expect(screen.getByRole('region', { name: 'Canonical catalog intelligence' })).toBeInTheDocument();
    expect(screen.getByText(/Legacy tracks have not been migrated, so this scan cannot assess catalog coverage/)).toBeInTheDocument();
    expect(screen.getByText(/separate from the legacy catalog/)).toBeInTheDocument();
    expect(screen.queryByText('No possible identifier collisions were observed in the available canonical snapshot.')).not.toBeInTheDocument();
  });
});
