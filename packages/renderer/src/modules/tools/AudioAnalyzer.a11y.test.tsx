import { render, screen } from '@testing-library/react'
import AudioAnalyzer from './AudioAnalyzer'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
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
        loading: vi.fn(),
        dismiss: vi.fn()
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

// Mock AudioIntelligenceService
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue({
            technical: { duration: 100, bpm: 120, key: 'C', scale: 'major', energy: 0.8 },
            semantic: {
                mood: ['Happy'], genre: ['Pop'], instruments: [],
                marketingHooks: { keywords: ['Viral'], oneLiner: 'Test' },
                visualImagery: { abstract: 'Test' },
                targetPrompts: { image: 'Test', veo: 'Test' }
            }
        })
    }
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
        const file = new File(['mock audio'], 'test.mp3', { type: 'audio/mp3' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Wait for save button to appear
        const saveButton = await screen.findByTestId('save-analysis-button')
        expect(saveButton).toBeInTheDocument()
        expect(saveButton).not.toBeDisabled() // Because we mocked isSaving to be false
    })
})
