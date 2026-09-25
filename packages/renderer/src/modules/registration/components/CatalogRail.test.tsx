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
      onSelectTrack={vi.fn()}
    />);

    expect(screen.getByRole('region', { name: 'Catalog intelligence' })).toBeInTheDocument();
    expect(screen.getByText('1 potential identifier conflict needs review.')).toBeInTheDocument();
    expect(screen.getByText(/Legacy details are unconfirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/ownership confirmed|registration complete/i)).not.toBeInTheDocument();
  });
});
