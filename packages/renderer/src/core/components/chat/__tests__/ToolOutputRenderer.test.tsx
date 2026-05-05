import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageRenderer } from '../ToolOutputRenderer';

const mockOpenImageInStudio = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            openImageInStudio: mockOpenImageInStudio
        })
    }
}));

vi.mock('../annotator/ImageAnnotator', () => ({
    ImageAnnotator: () => <div data-testid="image-annotator" />
}));

describe('ToolOutputRenderer — ImageRenderer', () => {
    const defaultProps = {
        src: 'https://example.com/test.jpg',
        alt: 'Test image',
        messageId: 'msg-123',
        agentId: 'generalist'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders image with correct src attribute', () => {
        render(<ImageRenderer {...defaultProps} />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.com/test.jpg');
    });

    it('renders desktop hover badge with data-testid="open-in-studio-badge"', () => {
        render(<ImageRenderer {...defaultProps} />);

        const badge = screen.getByTestId('open-in-studio-badge');
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toContain('Open in Studio');
    });

    it('renders mobile corner badge with "Open in Studio" text', () => {
        render(<ImageRenderer {...defaultProps} />);

        const badges = screen.getAllByText(/Open in Studio/i);
        expect(badges.length).toBeGreaterThanOrEqual(2); // Desktop + Mobile

        // Find the mobile badge by checking for md:hidden class
        const mobileBadge = badges.find(el => {
            const parent = el.closest('[class*="md:hidden"]');
            return parent !== null;
        });
        expect(mobileBadge).toBeInTheDocument();
    });

    it('calls openImageInStudio with correct args on container click', () => {
        render(<ImageRenderer {...defaultProps} />);

        const container = screen.getByRole('img').closest('div');
        expect(container).not.toBeNull();

        fireEvent.click(container!);

        expect(mockOpenImageInStudio).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceUrl: 'https://example.com/test.jpg',
                sourceMessageId: 'msg-123',
                agentId: 'generalist',
                prompt: 'Test image'
            })
        );
    });

    it('does NOT call openImageInStudio when messageId is absent', () => {
        render(<ImageRenderer {...defaultProps} messageId={undefined} />);

        const container = screen.getByRole('img').closest('div');
        fireEvent.click(container!);

        expect(mockOpenImageInStudio).not.toHaveBeenCalled();
    });

    it('does NOT call openImageInStudio when agentId is absent', () => {
        render(<ImageRenderer {...defaultProps} agentId={undefined} />);

        const container = screen.getByRole('img').closest('div');
        fireEvent.click(container!);

        expect(mockOpenImageInStudio).not.toHaveBeenCalled();
    });

    it('has accessible title="Inline Annotator" on annotator toggle button', () => {
        render(<ImageRenderer {...defaultProps} />);

        const button = screen.getByTitle('Inline Annotator');
        expect(button).toBeInTheDocument();
    });

    it('toggles annotator on/off when button clicked', () => {
        render(<ImageRenderer {...defaultProps} />);

        expect(screen.queryByTestId('image-annotator')).not.toBeInTheDocument();

        const button = screen.getByTitle('Inline Annotator');
        fireEvent.click(button);

        expect(screen.getByTestId('image-annotator')).toBeInTheDocument();

        fireEvent.click(button);

        expect(screen.queryByTestId('image-annotator')).not.toBeInTheDocument();
    });

    it('does NOT call openImageInStudio when annotator button is clicked (stopPropagation)', () => {
        render(<ImageRenderer {...defaultProps} />);

        const button = screen.getByTitle('Inline Annotator');
        fireEvent.click(button);

        expect(mockOpenImageInStudio).not.toHaveBeenCalled();
    });

    it('uses alt text as prompt argument', () => {
        const props = {
            ...defaultProps,
            alt: 'a red car on a beach'
        };

        render(<ImageRenderer {...props} />);

        const container = screen.getByRole('img').closest('div');
        fireEvent.click(container!);

        expect(mockOpenImageInStudio).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: 'a red car on a beach'
            })
        );
    });
});
