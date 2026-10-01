import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClaimsInboxTab } from './ClaimsInboxTab';
import type { RightsClaim } from '@indii/shared';
import { LegalService } from '@/services/legal/LegalService';

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
        expect(screen.getByText('No claims are recorded in this indii inbox')).toBeInTheDocument();
        expect(screen.getByText(/not a clearance or ownership finding/)).toBeInTheDocument();
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
        expect(screen.getByText(/Submitted provenance and evidence \(unverified\)/)).toBeInTheDocument();
        expect(screen.getByText('Reference: https://vault/split.pdf')).toBeInTheDocument();
    });

    it('shows unavailable source separately from a genuinely empty inbox', async () => {
        vi.spyOn(LegalService, 'loadCanonicalClaimsInbox').mockRejectedValueOnce(new Error('permission denied'));
        render(<ClaimsInboxTab />);

        expect(await screen.findByText('Claims data is unavailable')).toBeInTheDocument();
        expect(screen.getByText(/No conclusion about disputes or catalog status is available/)).toBeInTheDocument();
        expect(screen.queryByText('No claims are recorded in this indii inbox')).not.toBeInTheDocument();
    });

    it('loads the persisted owner inbox and records an assertion for human review', async () => {
        vi.spyOn(LegalService, 'loadCanonicalClaimsInbox').mockResolvedValueOnce({
            claims: [], events: [], evaluatedAt: '2026-10-01T12:00:00.000Z', storageTruncated: false,
        });
        const declaredClaim: RightsClaim = {
            schemaVersion: 'rights-claim.v1',
            id: 'claim:new',
            targetEntityId: 'recording:new',
            type: 'MASTER',
            status: 'ASSERTED',
            territoryCodes: ['US'],
            provenance: {
                state: 'USER_DECLARED',
                sourceType: 'USER',
                evidence: [],
                observedAt: '2026-10-01T12:00:00.000Z',
            },
            createdAt: '2026-10-01T12:00:00.000Z',
            updatedAt: '2026-10-01T12:00:00.000Z',
        };
        const declaredEvent = {
            schemaVersion: 'music-domain-event.v1' as const,
            eventId: 'claim-received:claim:new',
            eventType: 'claim.received' as const,
            subject: { entityId: 'claim:new', entityType: 'rights_claim' as const },
            relatedEntities: [],
            occurredAt: '2026-10-01T12:00:00.000Z',
            recordedAt: '2026-10-01T12:00:00.000Z',
            details: { intake: 'owner-declared', targetEntityId: 'recording:new' },
            provenance: declaredClaim.provenance,
        };
        const declare = vi.spyOn(LegalService, 'declareCanonicalRightsClaim').mockResolvedValueOnce({ claim: declaredClaim, event: declaredEvent });
        render(<ClaimsInboxTab />);

        fireEvent.change(await screen.findByLabelText('Canonical target ID'), { target: { value: 'recording:new' } });
        fireEvent.click(screen.getByRole('button', { name: 'Record for review' }));

        await waitFor(() => expect(declare).toHaveBeenCalledWith(expect.objectContaining({
            targetEntityId: 'recording:new',
            type: 'MASTER',
            territoryCodes: ['WW'],
        })));
        expect(await screen.findByTestId('claim-item-claim:new')).toBeInTheDocument();
    });
});
