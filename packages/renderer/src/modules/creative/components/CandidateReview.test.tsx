import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CandidateReview, Candidate } from './CandidateReview';

// Mock motion/react to avoid animation complexity in tests
vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
            ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const makeCandidates = (count: number): Candidate[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `cand-${i}`,
        url: `https://example.com/img-${i}.png`,
        prompt: `Prompt ${i + 1}`,
    }));

describe('CandidateReview', () => {
    let onApply: (selected: Candidate[]) => void;
    let onClose: () => void;
    let onRegenerate: () => void;

    beforeEach(() => {
        onApply = vi.fn();
        onClose = vi.fn();
        onRegenerate = vi.fn();
    });

    it('renders nothing when candidates is empty', () => {
        const { container } = render(
            <CandidateReview candidates={[]} onApply={onApply} onClose={onClose} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders all 4 candidate cards', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );
        expect(screen.getByTestId('candidate-card-0')).toBeInTheDocument();
        expect(screen.getByTestId('candidate-card-1')).toBeInTheDocument();
        expect(screen.getByTestId('candidate-card-2')).toBeInTheDocument();
        expect(screen.getByTestId('candidate-card-3')).toBeInTheDocument();
    });

    it('shows "Review Options" header and selection counter', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );
        expect(screen.getByText('Review Options')).toBeInTheDocument();
        expect(screen.getByText('0/4 selected')).toBeInTheDocument();
    });

    it('toggles selection when clicking a card', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );
        const card0 = screen.getByTestId('candidate-card-0');
        fireEvent.click(card0);
        expect(screen.getByText('1/4 selected')).toBeInTheDocument();

        // Click again to deselect
        fireEvent.click(card0);
        expect(screen.getByText('0/4 selected')).toBeInTheDocument();
    });

    it('"Select All" selects all candidates', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );
        fireEvent.click(screen.getByTestId('toggle-select-all'));
        expect(screen.getByText('4/4 selected')).toBeInTheDocument();
        expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });

    it('"Deselect All" deselects all candidates', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );
        // Select all first
        fireEvent.click(screen.getByTestId('toggle-select-all'));
        expect(screen.getByText('4/4 selected')).toBeInTheDocument();

        // Now deselect all
        fireEvent.click(screen.getByTestId('toggle-select-all'));
        expect(screen.getByText('0/4 selected')).toBeInTheDocument();
    });

    it('Apply button is disabled when nothing selected', () => {
        render(
            <CandidateReview candidates={makeCandidates(2)} onApply={onApply} onClose={onClose} />
        );
        const applyBtn = screen.getByTestId('candidate-apply-btn');
        expect(applyBtn).toBeDisabled();
    });

    it('Apply button shows count and calls onApply with selected candidates', () => {
        const candidates = makeCandidates(4);
        render(
            <CandidateReview candidates={candidates} onApply={onApply} onClose={onClose} />
        );

        // Select cards 0 and 2
        fireEvent.click(screen.getByTestId('candidate-card-0'));
        fireEvent.click(screen.getByTestId('candidate-card-2'));

        const applyBtn = screen.getByTestId('candidate-apply-btn');
        expect(applyBtn).not.toBeDisabled();
        expect(applyBtn.textContent).toContain('Apply');
        expect(applyBtn.textContent).toContain('(2)');

        fireEvent.click(applyBtn);
        expect(onApply).toHaveBeenCalledWith([candidates[0], candidates[2]]);
    });

    it('calls onClose when close button is clicked', () => {
        render(
            <CandidateReview candidates={makeCandidates(2)} onApply={onApply} onClose={onClose} />
        );
        fireEvent.click(screen.getByTestId('candidate-review-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders Regenerate button when onRegenerate is provided', () => {
        render(
            <CandidateReview candidates={makeCandidates(2)} onApply={onApply} onClose={onClose} onRegenerate={onRegenerate} />
        );
        const regenBtn = screen.getByTestId('candidate-regenerate-btn');
        expect(regenBtn).toBeInTheDocument();
        fireEvent.click(regenBtn);
        expect(onRegenerate).toHaveBeenCalledTimes(1);
    });

    it('does not render Regenerate button when onRegenerate is not provided', () => {
        render(
            <CandidateReview candidates={makeCandidates(2)} onApply={onApply} onClose={onClose} />
        );
        expect(screen.queryByTestId('candidate-regenerate-btn')).not.toBeInTheDocument();
    });

    it('opens zoom modal when zoom button is clicked', () => {
        render(
            <CandidateReview candidates={makeCandidates(4)} onApply={onApply} onClose={onClose} />
        );

        // Zoom button appears on card hover — but in test, we can still query it
        const zoomBtns = screen.getAllByLabelText(/Zoom option/);
        expect(zoomBtns.length).toBe(4);

        fireEvent.click(zoomBtns[0]!);
        expect(screen.getByTestId('candidate-zoom-modal')).toBeInTheDocument();
    });

    it('applies only selected single candidate', () => {
        const candidates = makeCandidates(4);
        render(
            <CandidateReview candidates={candidates} onApply={onApply} onClose={onClose} />
        );

        fireEvent.click(screen.getByTestId('candidate-card-3'));
        fireEvent.click(screen.getByTestId('candidate-apply-btn'));
        expect(onApply).toHaveBeenCalledWith([candidates[3]]);
    });
});
