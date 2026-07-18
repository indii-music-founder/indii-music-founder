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
        window.scrollTo = vi.fn();
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
        vi.mocked(ImageGeneration.captionImage).mockResolvedValue('A moonlit stage conclusion');
        vi.mocked(ImageGeneration.remixImage).mockResolvedValue({ url: 'https://assets.example.test/original-target.png' } as never);
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

    it('blocks Director Mode for an edited trajectory until it synthesizes a matching target frame', async () => {
        render(<AutonomousLab />);
        const dropzone = screen.getByText('Drop asset here').parentElement?.parentElement;
        fireEvent.drop(dropzone!, { dataTransfer: { getData: () => 'image-1', files: [] } });

        fireEvent.click(screen.getByRole('button', { name: /Synthesize Sequence/i }));
        await screen.findByText('Engine Trajectory');

        fireEvent.click(screen.getByText('Engine Trajectory'));
        const trajectory = screen.getByPlaceholderText('Review and edit the cinematic trajectory...');
        fireEvent.change(trajectory, { target: { value: 'A dawn performance finale with gold light.' } });
        expect(screen.getByText('Draft only — target frame unchanged')).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: /Enter Director Mode/i })[0]!);
        expect(mockStoreRef.current.setVideoInputs).not.toHaveBeenCalled();

        vi.mocked(ImageGeneration.remixImage).mockResolvedValueOnce({ url: 'https://assets.example.test/revised-target.png' } as never);
        fireEvent.click(screen.getByRole('button', { name: /Apply & re-synthesize/i }));
        await screen.findByText('Applied to target frame');

        fireEvent.click(screen.getAllByRole('button', { name: /Enter Director Mode/i })[0]!);
        expect(mockStoreRef.current.setVideoInputs).toHaveBeenCalledWith(expect.objectContaining({
            lastFrame: expect.objectContaining({ url: 'https://assets.example.test/revised-target.png' }),
        }));
    });
});
