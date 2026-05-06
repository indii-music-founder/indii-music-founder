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

// ── Fixtures ───────────────────────────────────────────────────────────────

const mockItem = {
    id: 'test-item-1',
    url: 'http://cdn.test/test.png',
    type: 'image' as const,
    prompt: 'A test image',
    timestamp: Date.now(),
    projectId: 'test-project',
    origin: 'generated' as const
};

const defaultProps = {
    isMagicFillMode: false,
    magicFillPrompt: '',
    setMagicFillPrompt: vi.fn(),
    handleMagicFill: vi.fn(),
    isProcessing: false,
    saveCanvas: vi.fn(),
    item: mockItem,
    endFrameItem: null,
    setEndFrameItem: vi.fn(),
    setIsSelectingEndFrame: vi.fn(),
    handleAnimate: vi.fn(),
    onClose: vi.fn(),
    isHighFidelity: false,
    setIsHighFidelity: vi.fn(),
    batchExportDimensions: vi.fn(),
    flattenCanvas: vi.fn(),
    onSendToWorkflow: vi.fn()
};

function renderHeader(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(<CanvasHeader {...props} />), props };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CanvasHeader — Multi-Format Export & Controls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Core Layout ---

    it('renders the header title', () => {
        renderHeader();
        expect(screen.getByText('Creative Editor')).toBeInTheDocument();
    });

    // --- Actions ---

    it('calls saveCanvas when Save is clicked', () => {
        const saveCanvas = vi.fn();
        renderHeader({ saveCanvas });
        fireEvent.click(screen.getByTestId('save-canvas-btn'));
        expect(saveCanvas).toHaveBeenCalledOnce();
    });

    it('calls batchExportDimensions when Multi-Format is clicked', () => {
        const batchExportDimensions = vi.fn();
        renderHeader({ batchExportDimensions });
        fireEvent.click(screen.getByText('Multi-Format'));
        expect(batchExportDimensions).toHaveBeenCalledOnce();
    });

    it('calls flattenCanvas when Flatten is clicked', () => {
        const flattenCanvas = vi.fn();
        renderHeader({ flattenCanvas });
        fireEvent.click(screen.getByText('Flatten'));
        expect(flattenCanvas).toHaveBeenCalledOnce();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        renderHeader({ onClose });
        fireEvent.click(screen.getByTestId('canvas-close-btn'));
        expect(onClose).toHaveBeenCalledOnce();
    });

    // --- Send to Video ---

    it('calls onSendToWorkflow when Send to Video is clicked', () => {
        const onSendToWorkflow = vi.fn();
        renderHeader({ onSendToWorkflow });
        fireEvent.click(screen.getByTestId('send-to-video-btn'));
        expect(onSendToWorkflow).toHaveBeenCalledWith('firstFrame', mockItem);
    });

    it('disables Send to Video when isProcessing is true', () => {
        renderHeader({ isProcessing: true });
        expect(screen.getByTestId('send-to-video-btn')).toBeDisabled();
    });

    // --- Animation / Last Frame ---

    it('shows Create Last Frame button when no endFrameItem exists', () => {
        renderHeader({ endFrameItem: null });
        expect(screen.getByTestId('create-last-frame-inline-btn')).toBeInTheDocument();
    });

    it('calls setIsSelectingEndFrame when Create Last Frame is clicked', () => {
        const setIsSelectingEndFrame = vi.fn();
        renderHeader({ setIsSelectingEndFrame, endFrameItem: null });
        fireEvent.click(screen.getByTestId('create-last-frame-inline-btn'));
        expect(setIsSelectingEndFrame).toHaveBeenCalledWith(true);
    });

    it('shows end frame preview and remove button when endFrameItem exists', () => {
        const setEndFrameItem = vi.fn();
        renderHeader({
            endFrameItem: { id: 'end-1', url: 'http://cdn.test/end.png', prompt: 'end', type: 'image' },
            setEndFrameItem
        });
        expect(screen.getByText('End Frame')).toBeInTheDocument();
        expect(screen.getByAltText('End Frame')).toBeInTheDocument();
        
        // Remove end frame
        fireEvent.click(screen.getByLabelText('Remove end frame'));
        expect(setEndFrameItem).toHaveBeenCalledWith(null);
    });

    it('calls handleAnimate when Animate is clicked', () => {
        const handleAnimate = vi.fn();
        renderHeader({ handleAnimate });
        fireEvent.click(screen.getByTestId('animate-btn'));
        expect(handleAnimate).toHaveBeenCalledOnce();
    });

    // --- High Fidelity Toggle ---

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

    // --- Magic Fill ---

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
