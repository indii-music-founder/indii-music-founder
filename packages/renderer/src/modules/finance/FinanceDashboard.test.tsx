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

vi.mock('@/modules/finance/components/FormatFoundryModule', () => ({
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

    it('renders grouped tabs; Royalty Statement Forensics lives in the Royalties group (ISSUE-1440)', () => {
        render(<FinanceDashboard />);

        // Top level shows 5 group triggers…
        expect(screen.getByTestId('finance-group-overview')).toBeInTheDocument();
        expect(screen.getByTestId('finance-group-royalties')).toBeInTheDocument();
        // …default group sub-tabs render with their existing deep-link testids…
        expect(screen.getByTestId('finance-tab-overview')).toBeInTheDocument();
        expect(screen.queryByTestId('finance-tab-forensics')).not.toBeInTheDocument();
        // …and the forensics sub-tab appears once its group is active.
        fireEvent.click(screen.getByTestId('finance-group-royalties'));
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

        // ISSUE-1440: forensics is a sub-tab of the Royalties group now.
        fireEvent.click(screen.getByTestId('finance-group-royalties'));
        fireEvent.click(screen.getByTestId('finance-tab-forensics'));
        expect(setFinanceTab).toHaveBeenCalledWith('forensics');
    });
});
