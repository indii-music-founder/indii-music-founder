import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClaimsInboxTab } from './ClaimsInboxTab';
import type { RightsClaim } from '@indii/shared';

describe('ClaimsInboxTab', () => {
    const mockClaims: RightsClaim[] = [
        {
            schemaVersion: 'rights-claim.v1',
            id: 'claim_alpha',
            targetEntityId: 'recording_123',
            claimantEntityId: 'publisher_a',
            type: 'COMPOSITION',
            status: 'ASSERTED',
            territoryCodes: ['WW'],
            provenance: {
                state: 'USER_DECLARED',
                sourceType: 'USER',
                evidence: [{ id: 'ev_1', type: 'DOCUMENT', uri: 'https://vault/split.pdf', description: 'Split Sheet' }],
                observedAt: '2026-09-20T12:00:00.000Z',
            },
            createdAt: '2026-09-20T12:00:00.000Z',
            updatedAt: '2026-09-20T12:00:00.000Z',
        },
        {
            schemaVersion: 'rights-claim.v1',
            id: 'claim_beta',
            targetEntityId: 'recording_123',
            claimantEntityId: 'publisher_b',
            type: 'COMPOSITION',
            status: 'ASSERTED',
            territoryCodes: ['WW'],
            provenance: {
                state: 'USER_DECLARED',
                sourceType: 'USER',
                evidence: [],
                observedAt: '2026-09-21T12:00:00.000Z',
            },
            createdAt: '2026-09-21T12:00:00.000Z',
            updatedAt: '2026-09-21T12:00:00.000Z',
        },
    ];

    it('renders empty state when no claims exist', () => {
        render(<ClaimsInboxTab initialClaims={[]} />);
        expect(screen.getByText('No active advisory claims found')).toBeInTheDocument();
    });

    it('renders projected claims and identifies conflicts', () => {
        render(<ClaimsInboxTab initialClaims={mockClaims} />);

        expect(screen.getByText('Advisory Claims Inbox')).toBeInTheDocument();
        expect(screen.getByTestId('claim-item-claim_alpha')).toBeInTheDocument();
        expect(screen.getByTestId('claim-item-claim_beta')).toBeInTheDocument();

        // Both claims conflict with each other over COMPOSITION WW scope
        expect(screen.getAllByText('Conflict Detected').length).toBe(2);
    });

    it('filters by conflicts only', () => {
        render(<ClaimsInboxTab initialClaims={mockClaims} />);

        const conflictFilterBtn = screen.getByTestId('filter-conflicts-only');
        fireEvent.click(conflictFilterBtn);

        expect(screen.getByTestId('claim-item-claim_alpha')).toBeInTheDocument();
        expect(screen.getByTestId('claim-item-claim_beta')).toBeInTheDocument();
    });

    it('expands claim details on click', () => {
        render(<ClaimsInboxTab initialClaims={mockClaims} />);

        const claimAlpha = screen.getByTestId('claim-item-claim_alpha');
        fireEvent.click(claimAlpha.querySelector('div')!);

        expect(screen.getByText('Review Reasons')).toBeInTheDocument();
        expect(screen.getByText('Overlapping Scope Assertions')).toBeInTheDocument();
    });
});
