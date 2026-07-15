import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SyncBriefMatcher } from './SyncBriefMatcher';
import { licensingService } from '@/services/licensing/LicensingService';
import { syncLicensingClearanceService } from '@/services/licensing/SyncLicensingClearanceService';

vi.mock('@/services/licensing/LicensingService', () => ({
    licensingService: {
        getSyncBriefs: vi.fn(),
        getCatalogTracksForSync: vi.fn(),
    },
}));

vi.mock('@/services/licensing/SyncLicensingClearanceService', () => ({
    syncLicensingClearanceService: {
        createClearanceRequirement: vi.fn(),
        uploadClearanceFile: vi.fn(),
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
        vi.mocked(syncLicensingClearanceService.createClearanceRequirement).mockResolvedValue({
            id: 'clearance-req-1',
            userId: 'test-uid',
            releaseId: 'brief-1',
            trackId: 'track-1',
            trackTitle: 'Lead Song',
            docType: 'sync_license',
            status: 'pending_upload',
            storagePath: null,
            downloadUrl: null,
            originalFilename: null,
            description: 'Clearance for "Lead Song" -> brief "Project Alpha"',
            briefId: 'brief-1',
            briefProject: 'Project Alpha',
            trackISRC: 'US-AAA-26-00001',
            createdAt: {} as any,
            updatedAt: {} as any,
        });
        vi.mocked(syncLicensingClearanceService.uploadClearanceFile).mockResolvedValue({
            id: 'clearance-req-1',
            userId: 'test-uid',
            releaseId: 'brief-1',
            trackId: 'track-1',
            trackTitle: 'Lead Song',
            docType: 'sync_license',
            status: 'uploaded',
            storagePath: 'users/test-uid/clearance/brief-1/track-1/clearance.pdf',
            downloadUrl: 'https://example.com/clearance.pdf',
            originalFilename: 'clearance.pdf',
            description: 'Clearance for "Lead Song" -> brief "Project Alpha"',
            briefId: 'brief-1',
            briefProject: 'Project Alpha',
            trackISRC: 'US-AAA-26-00001',
            createdAt: {} as any,
            updatedAt: {} as any,
        });
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

        // Verify service methods were called correctly (ISSUE-827)
        expect(syncLicensingClearanceService.createClearanceRequirement).toHaveBeenCalledWith(
            'test-uid', // uid from auth mock
            'brief-1',
            'track-1',
            'Lead Song',
            'sync_license',
            expect.stringContaining('Clearance for'),
            undefined,
            undefined,
            expect.objectContaining({
                briefId: 'brief-1',
                briefProject: 'Project Alpha',
                trackISRC: 'US-AAA-26-00001',
            })
        );
        expect(syncLicensingClearanceService.uploadClearanceFile).toHaveBeenCalledWith(
            'clearance-req-1',
            expect.objectContaining({ name: 'clearance.pdf' })
        );

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => {
            expect(screen.getByText('Uploaded')).toBeInTheDocument();
            expect(screen.queryByText('Submitted')).toBeNull();
        });
    });
});
