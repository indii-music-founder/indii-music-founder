import { render, screen } from '@testing-library/react'
import AudioAnalyzer from './AudioAnalyzer'
import { describe, it, expect, vi } from 'vitest'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import React from 'react'

expect.extend(matchers)

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn(),
        updateProgress: vi.fn(),
    })
}))

// Mock audioAnalysisService
vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn(),
        generateFileHash: vi.fn(),
        saveAnalysisToFirestore: vi.fn()
    }
}))

// vi.mock factories are hoisted above regular declarations, so the fixture
// they close over must be created via vi.hoisted rather than a plain const.
const { MOCK_PROFILE } = vi.hoisted(() => ({ MOCK_PROFILE: {
    technical: { duration: 100, bpm: 120, key: 'C', scale: 'major', energy: 0.8 },
    semantic: {
        mood: ['Happy'], genre: ['Pop'], instruments: [],
        marketingHooks: { keywords: ['Viral'], oneLiner: 'Test' },
        visualImagery: { abstract: 'Test' },
        targetPrompts: { image: 'Test', veo: 'Test' }
    }
} }));

// Mock AudioIntelligenceService. `window.electronAPI` is undefined in this
// test environment, so the file-input upload below exercises the browser
// hydration branch (ISSUE-1152) — hence the receipt/persist mocks alongside it.
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue(MOCK_PROFILE),
        analyzeCanonicalMaster: vi.fn().mockResolvedValue(MOCK_PROFILE),
    }
}))

vi.mock('@/services/audio/FingerprintService', () => ({
    fingerprintService: { generateFingerprint: vi.fn().mockResolvedValue('mock-fingerprint') },
}))

vi.mock('@/services/audio/MasterAudioService', () => ({
    masterAudioService: {
        persist: vi.fn().mockResolvedValue({
            storagePath: 'masters/mock-owner/mock-hash/original.wav',
            contentHash: 'a'.repeat(64),
            generation: '1700000000000001',
            masterFingerprint: 'mock-fingerprint',
        }),
    },
}))

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'mock-owner' } },
}))

describe('AudioAnalyzer Accessibility', () => {
    it('should have accessible controls', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(<AudioAnalyzer />)

        // File Input should be accessible (sr-only, not hidden)
        const fileInput = screen.getByTestId('import-track-input')
        expect(fileInput).toHaveClass('sr-only')
        expect(fileInput).not.toHaveClass('hidden')

        // Trigger file load to render the post-analysis controls
        const file = new File(['mock audio'], 'test.wav', { type: 'audio/wav' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for save button to appear
        const saveButton = await screen.findByTestId('save-analysis-button')
        expect(saveButton).toBeInTheDocument()
        expect(saveButton).not.toBeDisabled() // Because we mocked isSaving to be false
    })
})
