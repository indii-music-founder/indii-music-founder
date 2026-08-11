import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageAnnotator } from '../ImageAnnotator';

const mocks = vi.hoisted(() => ({
    dispatchToolCall: vi.fn()
}));

// Mock AgentService
vi.mock('@/services/agent/AgentService', () => ({
    AgentService: vi.fn(function AgentServiceMock() {
        return { dispatchToolCall: mocks.dispatchToolCall };
    })
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'test-uuid'
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            conversationMode: 'direct',
            updateAgentMessage: vi.fn()
        })
    }
}));

describe('ImageAnnotator', () => {
    const defaultProps = {
        imageUrl: 'https://example.com/test.jpg',
        imageId: 'test-image-id',
        originalMessageId: 'orig-msg-id',
        agentId: 'generalist'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.dispatchToolCall.mockResolvedValue({ success: true });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            stroke: vi.fn(),
            fillRect: vi.fn(),
            fill: vi.fn()
        } as never);
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,bWFzaw==');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders color swatches and toolbar', () => {
        render(<ImageAnnotator {...defaultProps} />);
        
        expect(screen.getByTitle('red')).toBeInTheDocument();
        expect(screen.getByTitle('blue')).toBeInTheDocument();
        expect(screen.getByTitle('yellow')).toBeInTheDocument();
        expect(screen.getByTitle('Eraser')).toBeInTheDocument();
        expect(screen.getByTitle('Clear All')).toBeInTheDocument();
    });

    it('disables prompt inputs when no annotations exist for that color', () => {
        render(<ImageAnnotator {...defaultProps} />);
        
        const redInput = screen.getByPlaceholderText(/Draw red circles to enable/i);
        expect(redInput).toBeDisabled();
    });

    it('disables Apply button when no annotations exist', () => {
        render(<ImageAnnotator {...defaultProps} />);
        
        const applyBtn = screen.getByText(/Apply Edits/i).closest('button');
        expect(applyBtn).toBeDisabled();
    });

    it('clears annotations when Trash icon is clicked', async () => {
        // This is a bit hard to test fully since it involves drawing on canvas
        // but we can at least check if the component renders.
        render(<ImageAnnotator {...defaultProps} />);
        
        const clearBtn = screen.getByTitle('Clear All');
        fireEvent.click(clearBtn);
        
        // No crash
        expect(screen.getByText(/Apply Edits/i)).toBeInTheDocument();
    });

    it('sends the source image with drawn annotations to the editing tool', async () => {
        render(<ImageAnnotator {...defaultProps} />);

        const image = screen.getByAltText('Annotation target');
        Object.defineProperties(image, {
            naturalWidth: { configurable: true, value: 100 },
            naturalHeight: { configurable: true, value: 100 }
        });
        fireEvent.load(image);

        const canvas = document.querySelector('canvas');
        expect(canvas).not.toBeNull();
        vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            width: 100,
            height: 100,
            right: 100,
            bottom: 100,
            x: 0,
            y: 0,
            toJSON: () => ({})
        });

        const drawingSurface = image.parentElement!;
        fireEvent.mouseDown(drawingSurface, { clientX: 10, clientY: 10 });
        fireEvent.mouseMove(drawingSurface, { clientX: 30, clientY: 10 });
        fireEvent.mouseUp(drawingSurface);

        const redInput = await screen.findByPlaceholderText('Prompt for red regions...');
        fireEvent.change(redInput, { target: { value: 'make this region blue' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply Edits/i }));

        await waitFor(() => expect(mocks.dispatchToolCall).toHaveBeenCalledWith(
            'generalist',
            'edit_image_with_annotations',
            expect.objectContaining({
                imageId: 'test-image-id',
                imageUrl: 'https://example.com/test.jpg',
                maskData: 'data:image/png;base64,bWFzaw==',
                annotations: [{ color: 'red', cx: 10, cy: 10, r: 20 }],
                colorPrompts: expect.objectContaining({ red: 'make this region blue' })
            }),
            'orig-msg-id'
        ));
    });
});
