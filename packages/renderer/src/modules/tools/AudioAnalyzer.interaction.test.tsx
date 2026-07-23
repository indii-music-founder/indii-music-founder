import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AudioAnalyzer from './AudioAnalyzer';
import { useToast } from '@/core/context/ToastContext';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { musicLibraryService } from '@/services/music/MusicLibraryService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { masterAudioService } from '@/services/audio/MasterAudioService';
import React from 'react';

// --- Mocks ---

vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, property: string) => {
            if (property === 'div') {
                return ({ children, ...props }: any) => <div {...props}>{children}</div>;
            }
            // Add other common tags used in tests
            return ({ children, ...props }: any) => React.createElement(property, props, children);
        }
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/services/audio/SonicCortexService', () => ({
    sonicCortexService: {
        describeSoul: vi.fn().mockResolvedValue({
            description: 'A vibrant mock track',
            suggestedKeywords: ['Energetic', 'Punchy']
        }),
    },
}));

vi.mock('wavesurfer.js', () => ({
    default: {
        create: vi.fn(() => ({
            load: vi.fn(),
            on: vi.fn(),
            destroy: vi.fn(),
            registerPlugin: vi.fn(),
            getDuration: vi.fn(() => 100),
        })),
    },
}));

vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => ({
    default: {
        create: vi.fn(() => ({
            on: vi.fn(),
            addRegion: vi.fn(),
        })),
    },
}));

vi.mock('@/services/audio/MusicLibraryService', () => ({
    musicLibraryService: {
        getAnalysis: vi.fn().mockResolvedValue(null),
        saveAnalysis: vi.fn().mockResolvedValue(undefined),
    },
}));

// vi.mock factories are hoisted above regular declarations, so the fixture
// they close over must be created via vi.hoisted rather than a plain const.
const { MOCK_PROFILE } = vi.hoisted(() => ({ MOCK_PROFILE: {
    id: 'MOCK-HASH',
    technical: {
        bpm: 120,
        key: 'C',
        scale: 'major',
        energy: 0.5,
        duration: 100,
        moods: { happy: 0.8 },
        genre: { House: 0.9 },
        danceability: 0.5,
        valence: 0.8,
        loudness: -14,
        audit: {
            peakLevel: -1,
            integratedLoudness: -14,
            sampleRate: 44100,
            isStereo: true,
            rejectionRisks: []
        }
    },
    semantic: {
        mood: ['Energetic'],
        genre: ['House'],
        instruments: ['Synth'],
        ddexGenre: 'Electronic',
        ddexSubGenre: 'House',
        language: 'zxx',
        isExplicit: false,
        visualImagery: { abstract: 'Neon lights', narrative: 'Club scene', lighting: 'Strobe' },
        marketingHooks: { keywords: ['dance'], oneLiner: 'One liner' },
        targetPrompts: { image: 'image prompt', veo: 'veo prompt' }
    },
    analyzedAt: Date.now(),
    modelVersion: 'gemini-3.1-pro-preview'
} }));

// `window.electronAPI` is undefined in this test environment, so file-input
// uploads exercise the browser hydration branch (ISSUE-1152): fingerprint ->
// persist -> analyzeCanonicalMaster, not the Electron `.analyze()` path.
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue(MOCK_PROFILE),
        analyzeCanonicalMaster: vi.fn().mockResolvedValue(MOCK_PROFILE),
    }
}));

vi.mock('@/services/audio/FingerprintService', () => ({
    fingerprintService: {
        generateFingerprint: vi.fn().mockResolvedValue('mock-fingerprint'),
    },
}));

vi.mock('@/services/audio/MasterAudioService', () => ({
    masterAudioService: {
        persist: vi.fn().mockResolvedValue({
            storagePath: 'masters/mock-owner/mock-hash/original.wav',
            contentHash: 'a'.repeat(64),
            generation: '1700000000000001',
            masterFingerprint: 'mock-fingerprint',
        }),
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'mock-owner' } },
}));

vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn().mockResolvedValue({
            features: {
                bpm: 120,
                key: 'C',
                scale: 'major',
                energy: 0.5,
                duration: 100,
                moods: { happy: 0.8 },
                genre: { House: 0.9 },
                danceability: 0.5,
                valence: 0.8,
                voice_instrumental: 0,
            },
            fromCache: false
        }),
        generateFileHash: vi.fn().mockResolvedValue('MOCK-HASH'),
        saveAnalysisToFirestore: vi.fn().mockResolvedValue(undefined),
        analyzeBuffer: vi.fn().mockResolvedValue({ bpm: 120, key: 'C', scale: 'major', energy: 0.5, duration: 20 }),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(),
}));

// Mock AudioContext
const mockAudioContext = {
    createAnalyser: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(),
};

describe('AudioAnalyzer Interaction: Save Analysis', () => {
    const mockToast = {
        loading: vi.fn(() => 'toast-id'),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        updateProgress: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
        window.URL.createObjectURL = vi.fn(() => 'blob:mock');
        (useToast as unknown as import("vitest").Mock).mockReturnValue(mockToast);

        // Default mocks for analysis flow (MusicLibraryService removed)
    });

    it('🖱️ Click: Save Analysis (Synchronized with Music Library)', async () => {
        render(<AudioAnalyzer />);

        // Initially Save button is not present because profile is null
        expect(screen.queryByTestId('save-analysis-button')).not.toBeInTheDocument();

        const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
        const input = screen.getByTestId('import-track-input');
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for analysis result to trigger rendering of the save section
        const saveBtn = await screen.findByTestId('save-analysis-button');
        expect(saveBtn).toBeInTheDocument();

        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Estimated technical profile saved (not a certified distribution-compliance measurement).');
        });
    });

    it('rejects AIFF and ALAC containers instead of advertising unverified canonical-master support', async () => {
        render(<AudioAnalyzer />);
        const input = screen.getByTestId('import-track-input');

        fireEvent.change(input, {
            target: { files: [new File(['not-a-canonical-master'], 'master.aiff', { type: 'audio/aiff' })] },
        });

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(expect.stringMatching(/WAV or FLAC only/i));
        });
    });

    /**
     * ISSUE-1152 regression: the browser must persist the canonical master once
     * and hydrate from the server analysis receipt via `analyzeCanonicalMaster`
     * — never fall through to the raw-upload `.analyze()` path, which throws for
     * browser callers by design (ISSUE-962). Before this fix, nothing in the UI
     * called the hydration path at all.
     */
    describe('in the browser (no window.electronAPI)', () => {
        let originalElectronAPI: typeof window.electronAPI;

        beforeEach(() => {
            originalElectronAPI = window.electronAPI;
            // Global test setup stubs window.electronAPI for the desktop-app
            // suites; these two tests specifically cover the plain web build,
            // where that global is genuinely undefined.
             
            (window as any).electronAPI = undefined;
        });

        afterEach(() => {
            window.electronAPI = originalElectronAPI;
        });

        it('hydrates from the canonical-master receipt, not the raw-upload path', async () => {
            render(<AudioAnalyzer />);
            const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
            const input = screen.getByTestId('import-track-input');
            fireEvent.change(input, { target: { files: [file] } });

            await screen.findByTestId('save-analysis-button');

            expect(masterAudioService.persist).toHaveBeenCalledWith(file, {
                userId: 'mock-owner',
                masterFingerprint: 'mock-fingerprint',
            });
            expect(audioIntelligence.analyzeCanonicalMaster).toHaveBeenCalledTimes(1);
            expect(audioIntelligence.analyze).not.toHaveBeenCalled();
        });

        it('surfaces the real receipt/upload error instead of a canned connectivity message', async () => {
            vi.mocked(masterAudioService.persist).mockRejectedValueOnce(
                new Error('Canonical-master analysis is still processing. You can safely return and retry.'),
            );
            render(<AudioAnalyzer />);
            const input = screen.getByTestId('import-track-input');
            fireEvent.change(input, {
                target: { files: [new File(['audio'], 'test.wav', { type: 'audio/wav' })] },
            });

            await waitFor(() => {
                expect(mockToast.error).toHaveBeenCalledWith(
                    'Canonical-master analysis is still processing. You can safely return and retry.',
                );
            });
            expect(mockToast.error).not.toHaveBeenCalledWith(expect.stringMatching(/connectivity issues/i));
        });
    });
});
