import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QCPanel } from '../QCPanel';
import { distributionService } from '@/services/distribution/DistributionService';
import { audioAnalysisService } from '@/services/audio/AudioAnalysisService';
import { localAudioMetadataService } from '@/services/audio/LocalAudioMetadataService';

const { mockConnectedAnalyze } = vi.hoisted(() => ({ mockConnectedAnalyze: vi.fn() }));

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn(),
        updateProgress: vi.fn(),
    }),
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        validateReleaseMetadata: vi.fn(),
        generateContentIdAssets: vi.fn(),
    },
}));

vi.mock('@/components/shared/AudioWaveformViewer', () => ({
    AudioWaveformViewer: () => null,
}));

vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: { analyze: mockConnectedAnalyze },
}));

describe('QCPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ISSUE-1440: the metadata pane is conditionally mounted (default sub-tab is
    // acoustic) and its secondaries are collapsed — tests must navigate + open.
    function openMetadataPane() {
        fireEvent.click(screen.getByTestId('qc-subtab-metadata'));
    }

    it('should render input fields', () => {
        render(<QCPanel />);
        openMetadataPane();
        fireEvent.click(screen.getByRole('button', { name: /Optional & Content ID fields/i }));
        expect(screen.getByPlaceholderText(/Enter title/i)).toBeDefined();
        expect(screen.getByPlaceholderText(/Avoid generic names/i)).toBeDefined();
        expect(screen.getByPlaceholderText(/https/i)).toBeDefined();
    });

    it('should call validateReleaseMetadata when QC button is clicked', async () => {
        const mockReport = {
            valid: true,
            errors: [],
            warnings: [],
            summary: 'All good'
        };
        (distributionService.validateReleaseMetadata as import("vitest").Mock).mockResolvedValue(mockReport);

        render(<QCPanel />);
        openMetadataPane();

        // Fill inputs
        fireEvent.change(screen.getByPlaceholderText(/Enter title/i), { target: { value: 'Test Title' } });
        fireEvent.change(screen.getByPlaceholderText(/Avoid generic names/i), { target: { value: 'Test Artist' } });

        // Click Validate
        fireEvent.click(screen.getByText('Run QC'));

        await waitFor(() => {
            expect(distributionService.validateReleaseMetadata).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Title',
                artists: ['Test Artist']
            }));
        });

        // Check success state
        expect(screen.getByText('PASSED')).toBeDefined();
        expect(screen.getByText('All good')).toBeDefined();
    });

    it('should display errors when validation fails', async () => {
        const mockReport = {
            valid: false,
            errors: ['Title is too short'],
            warnings: [],
            summary: 'Validation failed'
        };
        (distributionService.validateReleaseMetadata as import("vitest").Mock).mockResolvedValue(mockReport);

        render(<QCPanel />);
        openMetadataPane();

        fireEvent.change(screen.getByPlaceholderText(/Enter title/i), { target: { value: 'Bad' } });
        fireEvent.change(screen.getByPlaceholderText(/Avoid generic names/i), { target: { value: 'Test Artist' } });
        fireEvent.click(screen.getByText('Run QC'));

        await waitFor(() => {
            expect(screen.getByText('FAILED')).toBeDefined();
            expect(screen.getByText('Title is too short')).toBeDefined();
        });
    });

    it('should call generateContentIdAssets with an explicit rights attestation when CID button is clicked (ISSUE-786)', async () => {
        (distributionService.generateContentIdAssets as import("vitest").Mock).mockResolvedValue('ISRC,Title\nUS123,Test');

        render(<QCPanel />);
        openMetadataPane();
        fireEvent.click(screen.getByRole('button', { name: /Optional & Content ID fields/i }));
        fireEvent.click(screen.getByRole('button', { name: /Content ID Rights Attestation/i }));

        fireEvent.change(screen.getByPlaceholderText(/Enter title/i), { target: { value: 'Test Title' } });
        fireEvent.change(screen.getByPlaceholderText(/Avoid generic names/i), { target: { value: 'Test Artist' } });
        fireEvent.change(screen.getByPlaceholderText(/US-XXX/i), { target: { value: 'USABC2600001' } });
        fireEvent.change(screen.getByTestId('qc-input-upc'), { target: { value: '123456789012' } });
        fireEvent.click(screen.getByTestId('qc-input-exclusive-rights'));
        fireEvent.change(screen.getByTestId('qc-input-rights-label'), { target: { value: 'Real Label LLC' } });
        fireEvent.change(screen.getByTestId('qc-input-match-policy'), { target: { value: 'monetize' } });
        fireEvent.change(screen.getByTestId('qc-input-territories'), { target: { value: 'US, CA' } });
        fireEvent.click(screen.getByText('Gen CID CSV'));

        await waitFor(() => {
            expect(distributionService.generateContentIdAssets).toHaveBeenCalledWith(expect.objectContaining({
                upc: '123456789012',
                artist: 'Test Artist',
                rights_attestation: {
                    exclusive_rights: true,
                    label: 'Real Label LLC',
                    match_policy: 'monetize',
                    territories: ['US', 'CA']
                }
            }));
        });

        expect(screen.getByText(/US123,Test/)).toBeDefined();
    });

    it('blocks Content ID generation without a rights attestation (ISSUE-786)', async () => {
        render(<QCPanel />);
        openMetadataPane();
        fireEvent.click(screen.getByRole('button', { name: /Optional & Content ID fields/i }));

        fireEvent.change(screen.getByPlaceholderText(/Enter title/i), { target: { value: 'Test Title' } });
        fireEvent.change(screen.getByPlaceholderText(/Avoid generic names/i), { target: { value: 'Test Artist' } });
        fireEvent.change(screen.getByPlaceholderText(/US-XXX/i), { target: { value: 'USABC2600001' } });
        fireEvent.change(screen.getByTestId('qc-input-upc'), { target: { value: '123456789012' } });
        // Deliberately leave the exclusive-rights checkbox unchecked and label/policy/territories empty.
        fireEvent.click(screen.getByText('Gen CID CSV'));

        await waitFor(() => {
            expect(distributionService.generateContentIdAssets).not.toHaveBeenCalled();
        });
        // ISSUE-1440: the failing attestation section auto-opens so the user is
        // looking at the fields that blocked generation.
        await waitFor(() => {
            expect(screen.getByTestId('qc-input-exclusive-rights')).toBeInTheDocument();
        });
    });

    it('renders the acoustic ingestion dropzone in acoustic sub-tab', () => {
        render(<QCPanel />);
        expect(screen.getByTestId('qc-audio-dropzone')).toBeInTheDocument();
        expect(screen.getByText('Load Audio Master')).toBeInTheDocument();
    });

    it('handles dragOver and dragLeave on the dropzone', () => {
        render(<QCPanel />);
        const dropzone = screen.getByTestId('qc-audio-dropzone');

        fireEvent.dragOver(dropzone);
        expect(dropzone.className).toContain('border-primary');

        fireEvent.dragLeave(dropzone);
        expect(dropzone.className).not.toContain('border-primary');
    });

    it('rejects lossy files dropped into the acoustic dropzone', () => {
        render(<QCPanel />);
        const dropzone = screen.getByTestId('qc-audio-dropzone');

        const mp3File = new File(['dummy audio content'], 'song.mp3', { type: 'audio/mpeg' });
        fireEvent.drop(dropzone, {
            dataTransfer: {
                files: [mp3File],
            },
        });

        expect(screen.getByTestId('qc-audio-dropzone')).toBeInTheDocument();
    });

    it('lets QC consume a local-only report without creating semantic or saved-agent output', async () => {
        const report = {
            id: 'a'.repeat(64),
            filename: 'local.wav',
            features: {
                bpm: 120, key: 'C', scale: 'major', energy: 0.5, duration: 30,
                danceability: 0.4, loudness: -12,
                audit: {
                    peakLevel: -0.2, truePeakDb: -0.2, integratedLoudness: -13,
                    sampleRate: 44100, isStereo: true, rejectionRisks: [],
                },
            },
            provenance: {
                state: 'DETECTED' as const,
                sourceType: 'SYSTEM' as const,
                sourceId: 'local-audio-analysis',
                evidence: [],
                observedAt: '2026-09-25T00:00:00.000Z',
            },
            mode: 'LOCAL_ONLY' as const,
            networkCalls: 0 as const,
            persisted: false as const,
        };
        const localAnalyze = vi.spyOn(audioAnalysisService, 'analyzeLocalOnly').mockResolvedValue(report);
        const localMetadata = vi.spyOn(localAudioMetadataService, 'inspect').mockResolvedValue({
            filename: 'local.wav',
            fields: [{ field: 'title', value: 'Detected, not authoritative' }],
            provenance: {
                state: 'DETECTED' as const,
                sourceType: 'SYSTEM' as const,
                sourceId: 'local-embedded-audio-metadata',
                evidence: [],
                observedAt: '2026-09-25T00:00:00.000Z',
                note: 'Unconfirmed embedded tags.',
            },
            mode: 'LOCAL_ONLY',
            networkCalls: 0,
            persisted: false,
        });
        const saveAnalysis = vi.spyOn(audioAnalysisService, 'saveAnalysisToFirestore');
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-test');
        const localFile = new File(['local bytes'], 'local.wav', { type: 'audio/wav' });

        render(<QCPanel />);
        fireEvent.click(screen.getByTestId('local-only-audio-analysis-mode'));
        fireEvent.change(screen.getByTestId('import-track-input'), { target: { files: [localFile] } });

        await waitFor(() => expect(localAnalyze).toHaveBeenCalledWith(localFile));
        expect(localMetadata).toHaveBeenCalledWith(localFile);
        expect(await screen.findByTestId('local-only-analysis-report')).toHaveTextContent('DETECTED');
        expect(await screen.findByTestId('local-embedded-metadata-report')).toHaveTextContent('Detected, not authoritative');
        expect(screen.getByTestId('local-embedded-metadata-report')).toHaveTextContent(/not copied into release metadata or saved/i);
        expect(screen.getByTestId('local-qc-advisory-only')).toHaveTextContent(/not platform compliance measurements/i);
        expect(screen.getAllByTestId('local-loudness-estimate-only')).toHaveLength(2);
        expect(screen.getByTestId('local-peak-estimate-only')).toHaveTextContent('Estimate only');
        expect(screen.queryByText('Penalized')).not.toBeInTheDocument();
        expect(screen.queryByText('Optimal')).not.toBeInTheDocument();
        expect(screen.queryByText('Clipping Risk')).not.toBeInTheDocument();
        expect(screen.queryByText('Distribution Spec')).not.toBeInTheDocument();
        expect(screen.queryByTestId('save-analysis-button')).not.toBeInTheDocument();
        expect(saveAnalysis).not.toHaveBeenCalled();
        expect(mockConnectedAnalyze).not.toHaveBeenCalled();
    });
});
