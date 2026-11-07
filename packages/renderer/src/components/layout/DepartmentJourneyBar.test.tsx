import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepartmentJourneyBar } from './DepartmentJourneyBar';

const { mockJudgeDepartmentJourneyIntent } = vi.hoisted(() => ({
    mockJudgeDepartmentJourneyIntent: vi.fn().mockResolvedValue({
        department: 'marketing',
        journeyId: 'mkt_calendar',
        headline: 'Schedule multi-channel teasers, pre-saves, and drop dates',
        actionLabel: 'Open Content Calendar',
        targetTab: 'calendar',
        confidence: 0.91,
    }),
}));

vi.mock('@/config/typesafeJudgments', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/config/typesafeJudgments')>();
    return {
        ...actual,
        judgeDepartmentJourneyIntent: (...args: unknown[]) => mockJudgeDepartmentJourneyIntent(...args),
    };
});

describe('DepartmentJourneyBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the inline Jev recommendation chip and Journeys popover trigger', async () => {
        const onSelectTab = vi.fn();
        render(
            <DepartmentJourneyBar
                department="marketing"
                activeTab="dashboard"
                onSelectTab={onSelectTab}
                itemCount={4}
            />,
        );

        const recBtn = screen.getByTestId('dept-journey-recommendation-marketing');
        expect(recBtn).toBeInTheDocument();

        fireEvent.click(recBtn);
        expect(onSelectTab).toHaveBeenCalledWith('departments');

        await waitFor(() => {
            expect(screen.getByTestId('dept-journey-hint-toast-marketing')).toBeInTheDocument();
        });
    });

    it('opens the Journeys menu, highlights Jev Pick, and routes to the chosen pathway', () => {
        const onSelectTab = vi.fn();
        render(
            <DepartmentJourneyBar
                department="distribution"
                activeTab="releases"
                onSelectTab={onSelectTab}
            />,
        );

        const toggleBtn = screen.getByTestId('dept-journeys-toggle-distribution');
        fireEvent.click(toggleBtn);

        expect(screen.getByTestId('dept-journeys-menu-distribution')).toBeInTheDocument();
        expect(screen.getByText('Jev Pick')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('dept-journey-option-preflight_qc'));
        expect(onSelectTab).toHaveBeenCalledWith('brain');
    });
});
