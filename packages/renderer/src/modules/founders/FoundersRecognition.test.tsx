import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useStore } from '@/core/store';
import type { FounderRecord } from '@/config/founders';

const mocks = vi.hoisted(() => ({
    founders: [] as FounderRecord[],
    shareSheetCall: vi.fn().mockResolvedValue('shared'),
}));

vi.mock('@/config/founders', () => ({
    get FOUNDERS() {
        return mocks.founders;
    },
}));

vi.mock('@/components/share/ShareSheet', () => ({
    ShareSheet: {
        call: mocks.shareSheetCall,
    },
}));

import FoundersRecognition from './FoundersRecognition';

const SAMPLE_FOUNDERS: FounderRecord[] = [
    {
        seat: 2,
        name: 'Nova Reign',
        joinedAt: '2026-03-17T00:00:00.000Z',
        verificationHash: '9f86d081884c7d659a2feaa0c55ad015',
        uid: 'uid-nova',
    },
    {
        seat: 3,
        name: 'Juno K',
        joinedAt: '2026-03-18T00:00:00.000Z',
        verificationHash: 'abcdef1234567890abcdef1234567890',
        uid: 'uid-juno',
    },
];

describe('FoundersRecognition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.founders = [...SAMPLE_FOUNDERS];
        (useStore as unknown as { setState: (patch: Record<string, unknown>) => void }).setState({
            setModule: vi.fn(),
            user: null,
            userProfile: { id: 'viewer-1', uid: 'viewer-1', displayName: 'Guest', isFounder: false },
        });
    });

    it('renders the empty state safely when FOUNDERS is empty', () => {
        mocks.founders = [];
        render(<FoundersRecognition />);
        expect(screen.getByText(/Founder recognition records will appear here/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Share my seat/i })).not.toBeInTheDocument();
    });

    it('never shows Share my seat to non-founder viewers even if name or uid matches', () => {
        (useStore as unknown as { setState: (patch: Record<string, unknown>) => void }).setState({
            userProfile: { id: 'uid-nova', uid: 'uid-nova', displayName: 'Nova Reign', isFounder: false },
        });
        render(<FoundersRecognition />);
        expect(screen.getByText('Nova Reign')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Share my seat/i })).not.toBeInTheDocument();
    });

    it('shows Share my seat only on the signed-in founder record and opens ShareSheet', () => {
        (useStore as unknown as { setState: (patch: Record<string, unknown>) => void }).setState({
            userProfile: { id: 'uid-nova', uid: 'uid-nova', displayName: 'Nova Reign', isFounder: true },
        });
        render(<FoundersRecognition />);

        const shareButtons = screen.getAllByRole('button', { name: /Share my seat/i });
        expect(shareButtons).toHaveLength(1);

        fireEvent.click(shareButtons[0]);
        expect(mocks.shareSheetCall).toHaveBeenCalledWith({
            title: 'Founder Seat Card',
            template: {
                kind: 'founder',
                name: 'Nova Reign',
                seat: 2,
                joinedAt: '2026-03-17T00:00:00.000Z',
                verificationHash: '9f86d081884c7d659a2feaa0c55ad015',
            },
            options: {
                brandColors: ['#FFB800', '#E65100'],
            },
        });
    });

    it('falls back to case-insensitive displayName matching when founder.uid is absent', () => {
        mocks.founders = [
            {
                seat: 4,
                name: 'Aria Pulse',
                joinedAt: '2026-04-01T00:00:00.000Z',
                verificationHash: '1122334455667788',
            },
            {
                seat: 5,
                name: 'Other Artist',
                joinedAt: '2026-04-02T00:00:00.000Z',
                verificationHash: '9988776655443322',
            },
        ];
        (useStore as unknown as { setState: (patch: Record<string, unknown>) => void }).setState({
            userProfile: { id: 'uid-aria', uid: 'uid-aria', displayName: '  aria pulse ', subscriptionTier: 'founder' },
        });
        render(<FoundersRecognition />);

        const shareButtons = screen.getAllByRole('button', { name: /Share my seat/i });
        expect(shareButtons).toHaveLength(1);
        fireEvent.click(shareButtons[0]);
        expect(mocks.shareSheetCall).toHaveBeenCalledWith(expect.objectContaining({
            template: expect.objectContaining({
                kind: 'founder',
                name: 'Aria Pulse',
                seat: 4,
            }),
        }));
    });
});
