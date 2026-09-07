import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusDashboard from './StatusDashboard';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'transition'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    motion: {
        button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...filterDomProps(props)}>{children}</button>,
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
    },
}));

vi.mock('@/lib/utils', () => ({
    cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('../MobileRemote', () => ({
    triggerHaptic: vi.fn(),
}));

describe('StatusDashboard', () => {
    it('renders the legal review card as unavailable', () => {
        render(<StatusDashboard connectionStatus="connected" isPaired={true} />);

        expect(screen.getByText('Legal Review')).toBeInTheDocument();
        expect(screen.getByText('Remote legal approvals are not wired up in mobile yet.')).toBeInTheDocument();
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Unavailable').closest('button')).toBeDisabled();
    });

    it('surfaces a Road Mode entry point on the home dashboard', () => {
        const onTabChange = vi.fn();

        render(<StatusDashboard connectionStatus="connected" isPaired={true} onTabChange={onTabChange} />);

        const roadButton = screen.getByRole('button', { name: /road mode/i });
        expect(roadButton).toBeEnabled();

        fireEvent.click(roadButton);

        expect(onTabChange).toHaveBeenCalledWith('road');
    });

    it('keeps Live Moment, Log Receipt, Track Miles, and Road Mode enabled when unpaired', () => {
        render(<StatusDashboard connectionStatus="idle" isPaired={false} />);

        const liveMoment = screen.getByText('Live Moment').closest('button');
        const logReceipt = screen.getByText('Log Receipt').closest('button');
        const trackMiles = screen.getByText('Track Miles').closest('button');
        const roadMode = screen.getByRole('button', { name: /road mode/i });

        expect(liveMoment).toBeEnabled();
        expect(logReceipt).toBeEnabled();
        expect(trackMiles).toBeEnabled();
        expect(roadMode).toBeEnabled();

        // Order Merch and Legal Review remain restricted/disabled
        const orderMerch = screen.getByText('Order Merch').closest('button');
        const legalReview = screen.getByText('Legal Review').closest('button');
        expect(orderMerch).toBeDisabled();
        expect(legalReview).toBeDisabled();
    });

    it('opens mileage modal and calculates IRS mileage deduction when tracking a gear run', () => {
        render(<StatusDashboard connectionStatus="idle" isPaired={false} />);

        const trackMiles = screen.getByText('Track Miles').closest('button');
        expect(trackMiles).toBeInTheDocument();
        fireEvent.click(trackMiles!);

        expect(screen.getByText('Track Miles & Run')).toBeInTheDocument();
        expect(screen.getByText('Auto-deductible at $0.67/mi')).toBeInTheDocument();

        // Select destination chip
        fireEvent.click(screen.getByRole('button', { name: 'Guitar Center' }));

        // Enter miles: 10 miles (round trip = 20 miles * 0.67 = $13.40)
        const milesInput = screen.getByPlaceholderText('e.g. 14.2');
        fireEvent.change(milesInput, { target: { value: '10' } });

        expect(screen.getByText(/Estimated Tax Deduction/i)).toBeInTheDocument();
        expect(screen.getByText(/\$13\.40/)).toBeInTheDocument();
    });

    it('navigates to capture tab when Log Receipt is clicked', () => {
        const onTabChange = vi.fn();
        render(<StatusDashboard connectionStatus="connected" isPaired={true} onTabChange={onTabChange} />);

        const logReceipt = screen.getByText('Log Receipt').closest('button');
        fireEvent.click(logReceipt!);

        expect(onTabChange).toHaveBeenCalledWith('capture');
    });
});
