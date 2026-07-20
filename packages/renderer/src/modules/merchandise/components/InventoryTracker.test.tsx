import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventoryState = vi.hoisted(() => ({ inventory: [] as unknown[], loading: false }));

vi.mock('../hooks/useInventory', () => ({
    useInventory: () => inventoryState,
}));

vi.mock('recharts', () => ({
    BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    CartesianGrid: () => null,
}));

import { InventoryTracker } from './InventoryTracker';

describe('InventoryTracker (ISSUE-939)', () => {
    beforeEach(() => {
        inventoryState.inventory = [];
        inventoryState.loading = false;
    });

    it('does not simulate a provider sync when no provider job is configured', () => {
        render(<InventoryTracker />);

        const providerControl = screen.getByRole('button', { name: 'Provider sync unavailable' });
        expect(providerControl).toBeDisabled();
        expect(providerControl).toHaveAttribute(
            'title',
            'Provider inventory sync is not configured. Inventory updates when Firestore data changes.',
        );
        expect(screen.queryByRole('button', { name: /^sync$/i })).toBeNull();
        expect(screen.getByText('No Inventory Data')).toBeInTheDocument();
    });
});
