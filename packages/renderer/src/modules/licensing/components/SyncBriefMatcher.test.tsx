import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SyncBriefMatcher } from './SyncBriefMatcher';
import { licensingService } from '@/services/licensing/LicensingService';

vi.mock('@/services/licensing/LicensingService', () => ({
    licensingService: {
        getSyncBriefs: vi.fn(),
        getCatalogTracksForSync: vi.fn(),
    },
}));

describe('SyncBriefMatcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(licensingService.getSyncBriefs).mockResolvedValue([
            {
                id: 'brief-1',
                project: 'Project Alpha',
                type: 'Film',
                network: 'Studio One',
                deadline: 'Jul 20, 2026',
                bpmMin: 90,
                bpmMax: 120,
                moods: ['Cinematic', 'Triumphant'],
                budget: '$15K',
                description: 'Need a big sync cue for the final scene.',
            },
        ]);
        vi.mocked(licensingService.getCatalogTracksForSync).mockResolvedValue([
            {
                id: 'track-1',
                title: 'Lead Song',
                bpm: 104,
                moods: ['Cinematic'],
                duration: '3:21',
                isrc: 'US-AAA-26-00001',
            },
        ]);
    });

    it('labels the flow as clearance upload only and not a submitted pitch', async () => {
        render(<SyncBriefMatcher />);

        await screen.findByText('Project Alpha');
        fireEvent.click(screen.getByText('Project Alpha'));

        fireEvent.click(screen.getByRole('button', {
            name: /Upload clearance for Lead Song and Project Alpha/i,
        }));

        const input = screen.getByLabelText('Select clearance documents');
        fireEvent.change(input, {
            target: {
                files: [new File(['clearance'], 'clearance.pdf', { type: 'application/pdf' })],
            },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Submit track with clearance documents' }));

        await screen.findByText('Clearance uploaded');
        expect(screen.queryByText('Submission received')).toBeNull();
        expect(screen.getByText(/internal clearance record, not a sync pitch submission/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => {
            expect(screen.getByText('Uploaded')).toBeInTheDocument();
            expect(screen.queryByText('Submitted')).toBeNull();
        });
    });
});
