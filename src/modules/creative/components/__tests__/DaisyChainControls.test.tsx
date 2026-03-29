import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DaisyChainControls from '../DaisyChainControls';

// Mock store helper
const mockSetVideoInput = vi.fn();
const mockStore = {
    videoInputs: {
        firstFrame: null,
        lastFrame: null,
        isDaisyChain: false,
        timeOffset: 4
    },
    setVideoInput: mockSetVideoInput
};

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector: any) => selector(mockStore))
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: vi.fn(() => ({
        success: vi.fn(),
        error: vi.fn()
    }))
}));

describe('DaisyChainControls', () => {
    const mockOnOpenFrameModal = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial state correctly', () => {
        render(<DaisyChainControls onOpenFrameModal={mockOnOpenFrameModal} />);
        expect(screen.getByTestId('first-frame-slot')).toBeDefined();
        expect(screen.getByTestId('last-frame-slot')).toBeDefined();
        expect(screen.getByTestId('daisy-chain-toggle')).toBeDefined();
        expect(screen.getByRole('slider')).toBeDefined();
    });

    it('triggers frame modal on slot click', () => {
        render(<DaisyChainControls onOpenFrameModal={mockOnOpenFrameModal} />);

        fireEvent.click(screen.getByTestId('first-frame-slot'));
        expect(mockOnOpenFrameModal).toHaveBeenCalledWith('firstFrame');

        fireEvent.click(screen.getByTestId('last-frame-slot'));
        expect(mockOnOpenFrameModal).toHaveBeenCalledWith('lastFrame');
    });

    it('updates time offset via slider', () => {
        render(<DaisyChainControls onOpenFrameModal={mockOnOpenFrameModal} />);
        const slider = screen.getByRole('slider');

        fireEvent.change(slider, { target: { value: '6' } });
        expect(mockSetVideoInput).toHaveBeenCalledWith('timeOffset', 6);
    });

    it('toggles daisy chain mode', () => {
        render(<DaisyChainControls onOpenFrameModal={mockOnOpenFrameModal} />);
        const toggle = screen.getByTestId('daisy-chain-toggle');

        fireEvent.click(toggle);
        expect(mockSetVideoInput).toHaveBeenCalledWith('isDaisyChain', true);
    });
});
