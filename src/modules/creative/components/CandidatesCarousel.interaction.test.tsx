import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CandidatesCarousel, Candidate } from './CandidatesCarousel';

describe('CandidatesCarousel Interaction (🖱️ Click)', () => {
    const mockCandidates: Candidate[] = [
        { id: 'c1', url: 'http://example.com/1.png', prompt: 'Variant 1' },
        { id: 'c2', url: 'http://example.com/2.png', prompt: 'Variant 2' },
    ];

    const mockOnSelect = vi.fn();
    const mockOnClose = vi.fn();

    it('verifies the selection lifecycle (Click → Callback)', () => {
        render(
            <CandidatesCarousel
                candidates={mockCandidates}
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );

        // 1. Ready State: Buttons exist
        const selectBtn1 = screen.getByTestId('candidate-select-btn-0');
        const selectBtn2 = screen.getByTestId('candidate-select-btn-1');

        // 2. Action: Click first candidate
        fireEvent.click(selectBtn1);

        // 3. Feedback: Callback fired with correct data
        expect(mockOnSelect).toHaveBeenCalledWith(mockCandidates[0], 0);

        // 4. Action: Click second candidate
        fireEvent.click(selectBtn2);

        // 5. Feedback: Callback fired again
        expect(mockOnSelect).toHaveBeenCalledWith(mockCandidates[1], 1);
    });

    it('verifies the close lifecycle (Click → Close)', () => {
        render(
            <CandidatesCarousel
                candidates={mockCandidates}
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );

        const closeBtn = screen.getByTestId('carousel-close-btn');

        // Action: Click Close
        fireEvent.click(closeBtn);

        // Feedback: Close callback fired
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('verifies the empty state (No Render)', () => {
        const { container } = render(
            <CandidatesCarousel
                candidates={[]}
                onSelect={mockOnSelect}
                onClose={mockOnClose}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
