import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JevRemoteHintBar } from './JevRemoteHintBar';
import type { MobileRemoteIntentJudgment } from '@/config/typesafeJudgments';

const sampleJudgment: MobileRemoteIntentJudgment = {
    recommendedTab: 'studio',
    recommendedDepartment: 'finance',
    actionLabel: 'Route to Finance',
    hint: 'Financial item — Finance can categorize and log it.',
    source: 'deterministic',
};

describe('JevRemoteHintBar', () => {
    it('renders nothing when judgment is null', () => {
        const { container } = render(<JevRemoteHintBar judgment={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the compact Jev department badge, hint, and clickable action button', () => {
        const onAction = vi.fn();
        render(<JevRemoteHintBar judgment={sampleJudgment} onAction={onAction} />);

        expect(screen.getByTestId('jev-remote-hint-bar')).toBeInTheDocument();
        expect(screen.getByText(/Jev · finance/i)).toBeInTheDocument();
        expect(screen.getByText(sampleJudgment.hint)).toBeInTheDocument();

        const btn = screen.getByTestId('jev-remote-hint-action');
        expect(btn).toHaveTextContent('Route to Finance');
        fireEvent.click(btn);
        expect(onAction).toHaveBeenCalledWith(sampleJudgment);
    });
});
