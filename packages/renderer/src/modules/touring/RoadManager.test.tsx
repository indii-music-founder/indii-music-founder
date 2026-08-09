import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RoadManager from './RoadManager';
import { useTouring } from './hooks/useTouring';

const mocks = vi.hoisted(() => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    compileRouteDraft: vi.fn(),
    checkSchedule: vi.fn(),
    findPlaces: vi.fn(),
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/services/firebase', () => ({
    functions: {},
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: { defaultConfig: {} },
    db: {},
    storage: {},
    app: {},
    messaging: {},
    appCheck: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
}));
vi.mock('./hooks/useTouring', () => ({ useTouring: vi.fn() }));
vi.mock('./components/TourMap', () => ({ TourMap: () => <div data-testid="tour-map" /> }));
vi.mock('./components/TourRouteOptimizer', () => ({
    TourRouteOptimizer: () => <div data-testid="tour-route-optimizer" />,
}));
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }));
vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector: (state: {
        pendingHandoffs: { touring: null };
        setModule: ReturnType<typeof vi.fn>;
        currentProjectId: string;
    }) => unknown) => selector({
        pendingHandoffs: { touring: null },
        setModule: vi.fn(),
        currentProjectId: 'test-project',
    })),
}));
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (_functionsInstance: unknown, name: string) => {
        if (name === 'generateItinerary') return mocks.compileRouteDraft;
        if (name === 'checkLogistics') return mocks.checkSchedule;
        if (name === 'findPlaces') return mocks.findPlaces;
        throw new Error(`Unexpected callable: ${name}`);
    },
}));

type TouringHookResult = ReturnType<typeof useTouring>;

function setupTouringMock(overrides: Partial<TouringHookResult> = {}) {
    const defaults: TouringHookResult = {
        itineraries: [],
        currentItinerary: null,
        setCurrentItinerary: vi.fn(),
        saveItinerary: vi.fn().mockResolvedValue(undefined),
        updateItineraryStop: vi.fn().mockResolvedValue(undefined),
        emergencyContacts: [],
        saveEmergencyContact: vi.fn().mockResolvedValue(undefined),
        deleteEmergencyContact: vi.fn().mockResolvedValue(undefined),
        loading: false,
    };
    vi.mocked(useTouring).mockReturnValue({ ...defaults, ...overrides });
}

function enterRoute() {
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2023-10-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2023-10-10' } });
    fireEvent.change(screen.getByLabelText('Route Waypoints'), { target: { value: 'New York' } });
    fireEvent.click(screen.getByLabelText('Add location'));
}

function getEnabledSaveDraftButton(): HTMLButtonElement {
    const button = screen.getAllByRole('button', { name: 'Save Route Draft' })
        .find(candidate => !candidate.hasAttribute('disabled'));
    expect(button).toBeDefined();
    return button as HTMLButtonElement;
}

describe('RoadManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.compileRouteDraft.mockResolvedValue({
            data: {
                status: 'route_draft',
                authority: 'user_inputs_only',
                stops: [{
                    date: '2023-10-01',
                    city: 'New York',
                    venue: '',
                    activity: 'Planning',
                    type: 'Planning',
                    notes: '',
                }],
                limitations: [
                    'Waypoints remain in the order entered by the user.',
                    'Road routing, distance, drive time, traffic, venue availability, and budget are not calculated.',
                ],
            },
        });
        mocks.checkSchedule.mockResolvedValue({
            data: {
                scope: 'schedule_only',
                hasConflicts: false,
                issues: [],
                suggestions: [],
                summary: 'No date-order or same-day multi-city conflicts were found within the limited check scope.',
                limitations: [
                    'This check covers date order and same-day multi-city conflicts only.',
                    'Road distance, drive time, traffic, venue availability, staffing, and operational feasibility are not verified.',
                ],
            },
        });
        mocks.findPlaces.mockResolvedValue({ data: { places: [] } });
        setupTouringMock();
    });

    it('renders route inputs', () => {
        render(<RoadManager />);
        expect(screen.getByText('Tour Parameters')).toBeInTheDocument();
        expect(screen.getByLabelText('Route Waypoints')).toBeInTheDocument();
    });

    it('adds and removes locations', async () => {
        render(<RoadManager />);
        fireEvent.change(screen.getByLabelText('Route Waypoints'), { target: { value: 'New York' } });
        fireEvent.click(screen.getByLabelText('Add location'));
        fireEvent.click(screen.getByLabelText('Remove New York'));
        await waitFor(() => expect(screen.queryByLabelText('Remove New York')).not.toBeInTheDocument());
    });

    it('parses comma-separated waypoints while retaining state abbreviations', () => {
        render(<RoadManager />);
        fireEvent.change(screen.getByLabelText('Route Waypoints'), {
            target: { value: 'Austin, TX, Orlando, Knoxville' },
        });
        fireEvent.click(screen.getByLabelText('Add location'));
        expect(screen.getByText('Austin, TX')).toBeInTheDocument();
        expect(screen.getByText('Orlando')).toBeInTheDocument();
        expect(screen.getByText('Knoxville')).toBeInTheDocument();
    });

    it('persists only the honest route-draft contract', async () => {
        const saveItinerary = vi.fn().mockResolvedValue(undefined);
        setupTouringMock({ saveItinerary });
        render(<RoadManager />);
        enterRoute();
        fireEvent.click(getEnabledSaveDraftButton());

        await waitFor(() => expect(saveItinerary).toHaveBeenCalledWith({
            stops: [expect.objectContaining({
                city: 'New York',
                date: '2023-10-01',
                venue: '',
                activity: 'Planning',
                type: 'Planning',
                notes: '',
            })],
            totalDistance: 'Not calculated',
            tourName: 'Route draft 2023-10-01 - New York',
        }));
        expect(mocks.toast.success).toHaveBeenCalledWith('Route draft saved');
    });

    it('does not report success when persistence fails', async () => {
        setupTouringMock({ saveItinerary: vi.fn().mockRejectedValue(new Error('Firestore unavailable')) });
        render(<RoadManager />);
        enterRoute();
        fireEvent.click(getEnabledSaveDraftButton());

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Failed to save route draft'));
        expect(mocks.toast.success).not.toHaveBeenCalledWith('Route draft saved');
    });

    it('rejects a route response that changes submitted waypoints', async () => {
        const saveItinerary = vi.fn().mockResolvedValue(undefined);
        setupTouringMock({ saveItinerary });
        mocks.compileRouteDraft.mockResolvedValueOnce({ data: {
            status: 'route_draft',
            authority: 'user_inputs_only',
            stops: [{
                city: 'Boston', date: '2023-10-01', venue: '',
                activity: 'Planning', type: 'Planning', notes: '',
            }],
            limitations: ['No external facts were checked.'],
        } });
        render(<RoadManager />);
        enterRoute();
        fireEvent.click(getEnabledSaveDraftButton());

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Failed to save route draft'));
        expect(saveItinerary).not.toHaveBeenCalled();
    });

    it('presents a limited schedule check without a logistics-verification claim', async () => {
        setupTouringMock({ currentItinerary: {
            id: 'itinerary-1',
            userId: 'test-user',
            tourName: 'Test Tour',
            stops: [{
                id: 'stop-1', date: '2023-10-01', city: 'New York', venue: 'MSG',
                activity: 'Show', type: 'Show', notes: '', distance: 50,
            }],
            totalDistance: '50 miles',
        } });
        render(<RoadManager />);

        expect(screen.getByText('Route Draft')).toBeInTheDocument();
        expect(screen.getByText(/Checks date order and same-day multi-city conflicts only/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Check Schedule' }));

        await waitFor(() => expect(screen.getByText('Schedule Checked')).toBeInTheDocument());
        expect(screen.getByText(/operational feasibility are not verified/)).toBeInTheDocument();
        expect(screen.queryByText(/Logistics Verified/)).not.toBeInTheDocument();
    });

    it('updates a same-day stop by stable id instead of the first matching date', async () => {
        const setCurrentItinerary = vi.fn();
        const updateItineraryStop = vi.fn().mockResolvedValue(undefined);
        setupTouringMock({
            currentItinerary: {
                id: 'itinerary-123',
                userId: 'test-user',
                tourName: 'Test Tour',
                stops: [
                    { id: 'stop-1', date: '2023-10-01', city: 'Detroit', venue: 'Club A', activity: 'Travel', notes: '' },
                    { id: 'stop-2', date: '2023-10-01', city: 'Chicago', venue: 'Club B', activity: 'Show', notes: '' },
                ],
                totalDistance: '300 miles',
            },
            setCurrentItinerary,
            updateItineraryStop,
        });
        render(<RoadManager />);

        fireEvent.click(screen.getAllByText('Edit')[1]!);
        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Milwaukee' } });
        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => expect(updateItineraryStop).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ id: 'stop-2', city: 'Milwaukee' }),
        ));
        expect(setCurrentItinerary).toHaveBeenCalledWith(expect.objectContaining({
            stops: [
                expect.objectContaining({ id: 'stop-1', city: 'Detroit' }),
                expect.objectContaining({ id: 'stop-2', city: 'Milwaukee' }),
            ],
        }));
    });
});
