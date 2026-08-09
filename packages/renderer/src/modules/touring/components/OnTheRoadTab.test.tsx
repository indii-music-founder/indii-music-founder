import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnTheRoadTab } from './OnTheRoadTab';
import type { Itinerary } from '../types';

const mocks = vi.hoisted(() => ({
    storeState: {
        userProfile: { id: 'user-1' } as { id: string } | null,
    },
    addExpense: vi.fn(),
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
    tourMapProps: {} as Record<string, unknown>,
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
}));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }));
vi.mock('@/services/finance/FinanceService', () => ({
    financeService: { addExpense: mocks.addExpense },
}));
vi.mock('./TourMap', () => ({
    TourMap: (props: Record<string, unknown>) => {
        mocks.tourMapProps = props;
        return <div data-testid="tour-map" />;
    },
}));
vi.mock('@/modules/finance/components/ExpenseManualEntryModal', () => ({
    ExpenseManualEntryModal: ({ onAdd }: { onAdd: (expense: Record<string, unknown>) => Promise<void> }) => (
        <button
            type="button"
            onClick={() => {
                void onAdd({
                    vendor: 'Fuel Stop',
                    amount: 42.5,
                    date: '2099-08-09',
                    description: '',
                }).catch(() => undefined);
            }}
        >
            Submit test expense
        </button>
    ),
}));

const routeDraft: Itinerary = {
    id: 'itinerary-1',
    userId: 'user-1',
    tourName: 'Route draft',
    totalDistance: '900 miles straight-line',
    stops: [{
        date: '2099-08-09',
        city: 'Detroit',
        venue: '',
        activity: 'Planning',
        notes: '',
    }],
};

function renderTab(itinerary: Itinerary = routeDraft, currentLocation = '') {
    return render(<OnTheRoadTab
        currentLocation={currentLocation}
        setCurrentLocation={vi.fn()}
        handleFindGasStations={vi.fn()}
        handleFindNearbyPlaces={vi.fn()}
        isFindingPlaces={false}
        nearbyPlaces={[]}
        itinerary={itinerary}
    />);
}

async function submitQuickExpense() {
    fireEvent.click(screen.getByRole('button', { name: 'Quick Expense' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit test expense' }));
}

describe('OnTheRoadTab production claims', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.storeState.userProfile = { id: 'user-1' };
        mocks.tourMapProps = {};
        mocks.addExpense.mockResolvedValue({ id: 'expense-1' });
    });

    it('shows schedule and location evidence without fabricated live telemetry', () => {
        renderTab();

        expect(screen.getByText('Scheduled: 8/9/2099')).toBeInTheDocument();
        expect(screen.getByText('Location not set')).toBeInTheDocument();
        expect(screen.queryByText(/ETA:|16:00|Satellite Uplink|GPS: Locked|Traffic: Clear/)).not.toBeInTheDocument();
        expect(screen.queryByText(/IRS rate|Tax Deductible|Log to Finance/)).not.toBeInTheDocument();
        expect(screen.queryByText('Recorded Leg Miles')).not.toBeInTheDocument();
        expect(mocks.tourMapProps.rangeRadiusMiles).toBeUndefined();
    });

    it('shows only mileage recorded on itinerary legs', () => {
        renderTab({
            ...routeDraft,
            stops: [
                { ...routeDraft.stops[0]!, distance: 12.5 },
                { ...routeDraft.stops[0]!, date: '2099-08-10', city: 'Chicago', distance: 7.5 },
            ],
        });

        const mileageCard = screen.getByText('Recorded Leg Miles')
            .closest('[class*="bg-\\[\\#161b22\\]"]') as HTMLElement | null;
        expect(mileageCard).not.toBeNull();
        expect(within(mileageCard!).getByText(/20/)).toBeInTheDocument();
        expect(screen.getByText('No tax or reimbursement status assigned')).toBeInTheDocument();
    });

    it('writes quick expenses with the authenticated user identity', async () => {
        renderTab();
        await submitQuickExpense();

        await waitFor(() => expect(mocks.addExpense).toHaveBeenCalledWith({
            userId: 'user-1',
            vendor: 'Fuel Stop',
            amount: 42.5,
            date: '2099-08-09',
            category: 'Travel',
            description: 'Expense at Detroit',
        }));
        expect(mocks.toast.success).toHaveBeenCalledWith('Travel expense added.');
    });

    it('reports a rejected quick-expense write instead of resolving successfully', async () => {
        mocks.addExpense.mockRejectedValueOnce(new Error('Firestore denied'));
        renderTab();
        await submitQuickExpense();

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Failed to add travel expense.'));
        expect(mocks.toast.success).not.toHaveBeenCalledWith('Travel expense added.');
        expect(screen.getByRole('button', { name: 'Submit test expense' })).toBeInTheDocument();
    });

    it('rejects quick expenses without a resolved authenticated profile', async () => {
        mocks.storeState.userProfile = null;
        renderTab();
        await submitQuickExpense();

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Sign in before adding an expense.'));
        expect(mocks.addExpense).not.toHaveBeenCalled();
    });
});
