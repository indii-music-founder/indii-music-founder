import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasActionRail } from '../CanvasActionRail';

const mockItem = {
    id: 'test-item-1',
    url: 'http://cdn.test/test.png',
    type: 'image' as const,
    prompt: 'A test image',
    timestamp: Date.now(),
    projectId: 'test-project',
    origin: 'generated' as const,
};

const defaultProps = {
    item: mockItem,
    endFrameItem: null,
    setEndFrameItem: vi.fn(),
    setIsSelectingEndFrame: vi.fn(),
    handleAnimate: vi.fn(),
    onClose: vi.fn(),
    onSendToWorkflow: vi.fn(),
    onCreateLastFrame: undefined,
    isProcessing: false,
    saveCanvas: vi.fn(),
    batchExportDimensions: vi.fn(),
    flattenCanvas: vi.fn(),
};

function renderRail(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(<CanvasActionRail {...props} />), props };
}

describe('CanvasActionRail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('routes save, export, flatten, video, animation, and close actions', () => {
        const saveCanvas = vi.fn();
        const batchExportDimensions = vi.fn();
        const flattenCanvas = vi.fn();
        const onSendToWorkflow = vi.fn();
        const handleAnimate = vi.fn();
        const onClose = vi.fn();

        renderRail({
            saveCanvas,
            batchExportDimensions,
            flattenCanvas,
            onSendToWorkflow,
            handleAnimate,
            onClose,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Multi-Format Export' }));
        fireEvent.click(screen.getByRole('button', { name: 'Flatten Canvas' }));
        fireEvent.click(screen.getByTestId('send-to-video-btn'));
        fireEvent.click(screen.getByTestId('save-canvas-btn'));
        fireEvent.click(screen.getByTestId('animate-btn'));
        fireEvent.click(screen.getByTestId('canvas-close-btn'));

        expect(batchExportDimensions).toHaveBeenCalledOnce();
        expect(flattenCanvas).toHaveBeenCalledOnce();
        expect(onSendToWorkflow).toHaveBeenCalledWith('firstFrame', mockItem);
        expect(saveCanvas).toHaveBeenCalledOnce();
        expect(handleAnimate).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('uses the configured last-frame handler before falling back to selector mode', () => {
        const onCreateLastFrame = vi.fn();
        const setIsSelectingEndFrame = vi.fn();

        renderRail({ onCreateLastFrame, setIsSelectingEndFrame });
        fireEvent.click(screen.getByTestId('create-last-frame-inline-btn'));

        expect(onCreateLastFrame).toHaveBeenCalledOnce();
        expect(setIsSelectingEndFrame).not.toHaveBeenCalled();
    });

    it('falls back to end-frame selection when no generation handler is available', () => {
        const setIsSelectingEndFrame = vi.fn();

        renderRail({ onCreateLastFrame: undefined, setIsSelectingEndFrame });
        fireEvent.click(screen.getByTestId('create-last-frame-inline-btn'));

        expect(setIsSelectingEndFrame).toHaveBeenCalledWith(true);
    });

    it('shows existing end frame as an action and removes it on click', () => {
        const setEndFrameItem = vi.fn();

        renderRail({
            endFrameItem: { id: 'end-1', url: 'http://cdn.test/end.png', prompt: 'end', type: 'image' },
            setEndFrameItem,
        });

        fireEvent.click(screen.getByLabelText('Remove end frame'));
        expect(screen.getByAltText('End Frame')).toBeInTheDocument();
        expect(setEndFrameItem).toHaveBeenCalledWith(null);
    });

    it('disables provider actions during processing', () => {
        renderRail({ isProcessing: true });

        expect(screen.getByRole('button', { name: 'Multi-Format Export' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Flatten Canvas' })).toBeDisabled();
        expect(screen.getByTestId('send-to-video-btn')).toBeDisabled();
        expect(screen.getByTestId('create-last-frame-inline-btn')).toBeDisabled();
    });
});
