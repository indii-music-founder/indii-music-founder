import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { CanvasHeader } from '../CanvasHeader';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id' }
    }
}));

const defaultProps = {
    isMagicFillMode: false,
    magicFillPrompt: '',
    setMagicFillPrompt: vi.fn(),
    handleMagicFill: vi.fn(),
    isProcessing: false,
    isHighFidelity: false,
    setIsHighFidelity: vi.fn(),
};

function renderHeader(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(<CanvasHeader {...props} />), props };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CanvasHeader — edit prompt and model mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the header title', () => {
        renderHeader();
        expect(screen.getByText('Creative Editor')).toBeInTheDocument();
    });

    it('calls setIsHighFidelity when Pro/Flash toggle is clicked', () => {
        const setIsHighFidelity = vi.fn();
        renderHeader({ isHighFidelity: false, setIsHighFidelity });
        fireEvent.click(screen.getByText('Flash').closest('button')!);
        expect(setIsHighFidelity).toHaveBeenCalledWith(true);
    });

    it('displays Pro when isHighFidelity is true', () => {
        renderHeader({ isHighFidelity: true });
        expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    it('calls setMagicFillPrompt on input change', () => {
        const setMagicFillPrompt = vi.fn();
        renderHeader({ setMagicFillPrompt, magicFillPrompt: '' });
        fireEvent.change(screen.getByTestId('magic-fill-input'), { target: { value: 'cyberpunk style' } });
        expect(setMagicFillPrompt).toHaveBeenCalledWith('cyberpunk style');
    });

    it('calls handleMagicFill when Enter is pressed in input', () => {
        const handleMagicFill = vi.fn();
        renderHeader({ handleMagicFill, magicFillPrompt: 'cyberpunk' });
        fireEvent.keyDown(screen.getByTestId('magic-fill-input'), { key: 'Enter' });
        expect(handleMagicFill).toHaveBeenCalledOnce();
    });

    it('calls handleMagicFill when Refine button is clicked', () => {
        const handleMagicFill = vi.fn();
        renderHeader({ handleMagicFill });
        fireEvent.click(screen.getByTestId('magic-generate-btn'));
        expect(handleMagicFill).toHaveBeenCalledOnce();
    });

    it('shows processing state on Refine button', () => {
        renderHeader({ isProcessing: true, processingStatus: 'Generating...' });
        expect(screen.getAllByText('Generating...')[0]).toBeInTheDocument();
        expect(screen.getByTestId('magic-generate-btn')).toBeDisabled();
    });
});
