import { render, screen } from '@testing-library/react'
import AudioAnalyzer from './AudioAnalyzer'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import React from 'react'

expect.extend(matchers)

// Mock WaveSurfer
vi.mock('wavesurfer.js', () => {
    return {
        default: {
            create: () => ({
                on: vi.fn(),
                load: vi.fn(),
                getDuration: vi.fn(() => 100),
                destroy: vi.fn(),
                playPause: vi.fn(),
                stop: vi.fn(),
                setVolume: vi.fn(),
                registerPlugin: vi.fn(),
            }),
        }
    }
})

// Mock RegionsPlugin
vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => {
    return {
        default: {
            create: () => ({
                on: vi.fn(),
                addRegion: vi.fn(),
            })
        }
    }
})

// Mock audioAnalysisService
vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn().mockResolvedValue({
            features: {
                bpm: 120,
                key: 'C',
                scale: 'major',
                energy: 0.8,
                danceability: 0.7,
                valence: 0.8,
                duration: 100
            },
            fromCache: false
        }),
        generateFileHash: vi.fn().mockResolvedValue('hash123')
    }
}))

// Mock musicLibraryService
vi.mock('@/services/music/MusicLibraryService', () => ({
    musicLibraryService: {
        saveAnalysis: vi.fn(),
        getAnalysis: vi.fn()
    }
}))

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn()
    })
}))

// ResizeObserver Mock
class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

beforeAll(() => {
    window.ResizeObserver = ResizeObserver;
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
})

afterAll(() => {
    vi.restoreAllMocks()
})

describe('AudioAnalyzer Accessibility', () => {
    it('should have accessible controls', async () => {
        const { container } = render(<AudioAnalyzer />)

        // Stop button should have a label
        const stopButton = screen.getByTestId('stop-button')
        expect(stopButton).toHaveAttribute('aria-label', 'Stop playback')

        // Play button should have a label
        const playButton = screen.getByTestId('play-pause-button')
        expect(playButton).toHaveAttribute('aria-label', 'Play')

        // Volume slider should have a label
        const volumeSlider = screen.getByTestId('volume-slider')
        expect(volumeSlider).toHaveAttribute('aria-label', 'Volume')

        // File Input should be accessible (sr-only, not hidden)
        const fileInput = screen.getByTestId('import-track-input')
        expect(fileInput).toHaveClass('sr-only')
        expect(fileInput).not.toHaveClass('hidden')
    })
})
