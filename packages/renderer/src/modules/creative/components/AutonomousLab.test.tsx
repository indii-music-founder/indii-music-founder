import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AutonomousLab from './AutonomousLab';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    })
}));
vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        captionImage: vi.fn(),
        remixImage: vi.fn()
    }
}));

// Provide a fake window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe('AutonomousLab (Sequence Architect)', () => {
    let mockStoreRef: { current: any };

    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreRef = {
            current: {
                userProfile: { id: 'user-1' },
                addToHistory: vi.fn(),
                currentProjectId: 'project-1',
                generatedHistory: [],
                uploadedImages: [
                    { id: 'image-1', url: 'data:image/png;base64,mock', type: 'image' }
                ],
                setViewMode: vi.fn(),
                setVideoInputs: vi.fn(),
                setStudioControls: vi.fn(),
                setGenerationMode: vi.fn()
            }
        };

        vi.mocked(useStore).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreRef.current);
            }
            return mockStoreRef.current;
        });
    });

    it('renders the Sequence Architect header and initial state', () => {
        render(<AutonomousLab />);
        
        expect(screen.getByText('Sequence Architect')).toBeInTheDocument();
        expect(screen.getByText('Drop asset here')).toBeInTheDocument();
        
        // Buttons should be in correct disabled states initially
        const synthesizeBtn = screen.getByRole('button', { name: /Synthesize Sequence/i });
        expect(synthesizeBtn).toBeDisabled();
    });

    it('handles drag and drop of an establishing shot', () => {
        render(<AutonomousLab />);
        
        const dropzone = screen.getByText('Drop asset here').parentElement?.parentElement;
        expect(dropzone).toBeInTheDocument();
        
        fireEvent.drop(dropzone!, {
            dataTransfer: {
                getData: () => 'image-1',
                files: []
            }
        });
        
        // The synthesize button should become enabled now that we have a seed image
        const synthesizeBtn = screen.getByRole('button', { name: /Synthesize Sequence/i });
        expect(synthesizeBtn).not.toBeDisabled();
    });
});
