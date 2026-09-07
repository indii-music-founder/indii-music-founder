import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinanceDashboard from './FinanceDashboard';

const mockUseStore = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: (...args: unknown[]) => mockUseStore(...args),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('./hooks/useFinance', () => ({
    useFinance: () => ({
        overview: null,
        loading: false,
        refreshOverview: vi.fn(),
        currency: 'USD',
        expenses: [],
        expensesLoading: false,
    }),
}));

vi.mock('@/modules/format-foundry/FormatFoundryModule', () => ({
    FormatFoundryModule: () => <div data-testid="mock-format-foundry">Format Foundry Module Content</div>,
}));

vi.mock('@/components/layout/ThreePanelDashboard', () => ({
    ThreePanelDashboard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function buildState(overrides: Record<string, unknown> = {}) {
    return {
        financeTab: 'overview',
        setFinanceTab: vi.fn(),
        ...overrides,
    };
}

describe('FinanceDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState())
        );
    });

    it('renders tabs including Royalty Statement Forensics', () => {
        render(<FinanceDashboard />);

        expect(screen.getByTestId('finance-tab-overview')).toBeInTheDocument();
        expect(screen.getByTestId('finance-tab-forensics')).toBeInTheDocument();
        expect(screen.getByText('Royalty Statement Forensics')).toBeInTheDocument();
    });

    it('renders FormatFoundryModule when forensics tab is selected', () => {
        const setFinanceTab = vi.fn();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ financeTab: 'forensics', setFinanceTab }))
        );

        render(<FinanceDashboard />);

        expect(screen.getByTestId('mock-format-foundry')).toBeInTheDocument();
    });

    it('calls setFinanceTab when forensics tab trigger is clicked', () => {
        const setFinanceTab = vi.fn();
        mockUseStore.mockImplementation((selector: (state: ReturnType<typeof buildState>) => unknown) =>
            selector(buildState({ financeTab: 'overview', setFinanceTab }))
        );

        render(<FinanceDashboard />);

        fireEvent.click(screen.getByTestId('finance-tab-forensics'));
        expect(setFinanceTab).toHaveBeenCalledWith('forensics');
    });
});
