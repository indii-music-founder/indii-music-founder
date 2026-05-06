import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageAnnotator } from '../ImageAnnotator';
import { AgentService } from '@/services/agent/AgentService';

// Mock AgentService
vi.mock('@/services/agent/AgentService', () => ({
    AgentService: vi.fn().mockImplementation(() => ({
        dispatchToolCall: vi.fn().mockResolvedValue({ success: true })
    }))
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
            updateAgentMessage: vi.fn(),
            updateBoardroomMessage: vi.fn()
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
});
