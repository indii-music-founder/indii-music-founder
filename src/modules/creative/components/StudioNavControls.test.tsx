import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudioNavControls from './StudioNavControls';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store');

describe('StudioNavControls', () => {
    const mockSetStudioControls = vi.fn();

    const defaultStore = {
        studioControls: {
            resolution: '1K',
            aspectRatio: '16:9',
            negativePrompt: '',
            seed: ''
        },
        setStudioControls: mockSetStudioControls
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(defaultStore);
    });

    it('renders dropdowns with correct values', () => {
        render(<StudioNavControls />);

        // Aspect Ratio
        expect(screen.getByDisplayValue('16:9')).toBeInTheDocument();
        // Resolution
        expect(screen.getByDisplayValue('1K')).toBeInTheDocument();
    });

    it('updates aspect ratio', () => {
        render(<StudioNavControls />);

        const select = screen.getByDisplayValue('16:9');
        fireEvent.change(select, { target: { value: '4:3' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ aspectRatio: '4:3' });
    });

    it('updates resolution', () => {
        render(<StudioNavControls />);

        const select = screen.getByDisplayValue('1K');
        fireEvent.change(select, { target: { value: '4K' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ resolution: '4K' });
    });

    it('toggles advanced settings', () => {
        render(<StudioNavControls />);

        // Find settings button (it has Settings2 icon, but we can find by title)
        const settingsButton = screen.getByTitle('Advanced Settings (Negative Prompt, Seed)');
        fireEvent.click(settingsButton);

        // Check if advanced settings are visible
        expect(screen.getByPlaceholderText('What to avoid...')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Random')).toBeInTheDocument();
    });

    it('updates negative prompt', () => {
        render(<StudioNavControls />);

        // Open advanced settings
        const settingsButton = screen.getByTitle('Advanced Settings (Negative Prompt, Seed)');
        fireEvent.click(settingsButton);

        const input = screen.getByPlaceholderText('What to avoid...');
        fireEvent.change(input, { target: { value: 'blurry' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ negativePrompt: 'blurry' });
    });

    it('updates seed', () => {
        render(<StudioNavControls />);

        // Open advanced settings
        const settingsButton = screen.getByTitle('Advanced Settings (Negative Prompt, Seed)');
        fireEvent.click(settingsButton);

        const input = screen.getByPlaceholderText('Random');
        fireEvent.change(input, { target: { value: '12345' } });

        expect(mockSetStudioControls).toHaveBeenCalledWith({ seed: '12345' });
    });
});
