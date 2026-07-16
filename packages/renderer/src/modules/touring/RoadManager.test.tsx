import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoadManager from './RoadManager';
import { useTouring } from './hooks/useTouring';

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

// Mock Firebase Functions
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
    getFirebaseAI: vi.fn(() => ({}))
}));

// Mock useTouring hook
vi.mock('./hooks/useTouring', () => ({
    useTouring: vi.fn(),
}));

// Mock Zustand store
vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => selector({
        pendingHandoffs: { touring: null },
        setModule: vi.fn(),
        currentProjectId: 'test-project',
    })),
}));

const setupTouringMock = (overrides: any = {}) => {
    const defaultValues = {
        itineraries: [],
        currentItinerary: null,
        setCurrentItinerary: vi.fn(),
        saveItinerary: vi.fn().mockResolvedValue(undefined),
        updateItineraryStop: vi.fn(),
        vehicleStats: {
            userId: 'test-user',
            milesDriven: 100,
            fuelLevelPercent: 75,
            tankSizeGallons: 20,
            mpg: 15,
            gasPricePerGallon: 4.00
        },
        saveVehicleStats: vi.fn().mockResolvedValue(undefined),
        emergencyContacts: [],
        saveEmergencyContact: vi.fn().mockResolvedValue(undefined),
        deleteEmergencyContact: vi.fn().mockResolvedValue(undefined),
        pendingHandoffs: {},
        loading: false,
    };
    vi.mocked(useTouring).mockReturnValue({ ...defaultValues, ...overrides } as any);
};

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (functionsInstance: unknown, name: string) => {
        console.log(`Mock httpsCallable called for: ${name}`);
        return vi.fn().mockImplementation(async (data) => {
            console.log(`Mock function executed for ${name} with data:`, data);
            if (name === 'generateItinerary') {
                return {
                    data: {
                        tourName: 'Test Tour',
                        stops: [
                            {
                                date: '2023-10-01',
                                city: 'New York',
                                venue: 'MSG',
                                activity: 'Show',
                                notes: 'Sold out'
                            }
                        ],
                        totalDistance: '1000 km',
                        estimatedBudget: '$50000'
                    }
                };
            }
            if (name === 'checkLogistics') {
                return {
                    data: {
                        isFeasible: true,
                        issues: [],
                        suggestions: ['Looks good']
                    }
                };
            }
            return { data: {} };
        });
    },
}));

describe('RoadManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupTouringMock();
    });

    it('renders input fields', () => {
        render(<RoadManager />);
        expect(screen.getByText('Tour Parameters')).toBeInTheDocument();
        expect(screen.getByLabelText('Route Waypoints')).toBeInTheDocument();
    });

    it('allows adding and removing locations', async () => {
        render(<RoadManager />);
        const input = screen.getByLabelText('Route Waypoints');
        const addButton = screen.getByLabelText('Add location');

        fireEvent.change(input, { target: { value: 'New York' } });
        fireEvent.click(addButton);

        expect(screen.getByLabelText('Remove New York')).toBeInTheDocument();

        // Remove location
        const removeButton = screen.getByLabelText('Remove New York');
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByLabelText('Remove New York')).not.toBeInTheDocument();
        });
    });

    it('parses and splits comma-separated waypoint list', async () => {
        render(<RoadManager />);
        const input = screen.getByLabelText('Route Waypoints');
        const addButton = screen.getByLabelText('Add location');

        fireEvent.change(input, { target: { value: 'detroit, orlando, knoxville' } });
        fireEvent.click(addButton);

        expect(screen.getByText('detroit')).toBeInTheDocument();
        expect(screen.getByText('orlando')).toBeInTheDocument();
        expect(screen.getByText('knoxville')).toBeInTheDocument();
    });

    it('retains city and state abbreviation as a single waypoint', async () => {
        render(<RoadManager />);
        const input = screen.getByLabelText('Route Waypoints');
        const addButton = screen.getByLabelText('Add location');

        fireEvent.change(input, { target: { value: 'Austin, TX' } });
        fireEvent.click(addButton);

        expect(screen.getByText('Austin, TX')).toBeInTheDocument();
    });

    it('generates itinerary when inputs are valid', async () => {
        render(<RoadManager />);

        // Setup mock return
        const saveItineraryMock = vi.fn().mockResolvedValue(undefined);
        setupTouringMock({ saveItinerary: saveItineraryMock });

        const startDateInput = screen.getByLabelText('Start Date');
        const endDateInput = screen.getByLabelText('End Date');

        fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
        fireEvent.change(endDateInput, { target: { value: '2023-10-10' } });

        // Add location
        const locationInput = screen.getByLabelText('Route Waypoints');
        fireEvent.change(locationInput, { target: { value: 'New York' } });
        fireEvent.keyDown(locationInput, { key: 'Enter', code: 'Enter' });

        // Wait for location to appear
        await waitFor(() => {
            expect(screen.getByLabelText('Remove New York')).toBeInTheDocument();
        });

        const generateButton = screen.getByText('Initialize Route');
        expect(generateButton).not.toBeDisabled();

        fireEvent.click(generateButton);

        // Check for loading state
        expect(screen.getByText('Calculating Route...')).toBeInTheDocument();

        await waitFor(() => {
            expect(saveItineraryMock).toHaveBeenCalled();
        }, { timeout: 3000 });
    });

    it('checks logistics after generating itinerary', async () => {
        // Pre-load an itinerary into the hook mock to simulate state where logistics can be checked
        setupTouringMock({
            currentItinerary: {
                id: '123',
                tourName: 'Test Tour',
                stops: [
                    {
                        date: '2023-10-01',
                        city: 'New York',
                        venue: 'MSG',
                        type: 'Show',
                        distance: 50
                    }
                ],
                totalDistance: '1000 km',
                estimatedBudget: '$50'
            }
        });

        render(<RoadManager />);

        // Wait for itinerary to be rendered
        await waitFor(() => {
            expect(screen.getByText('Generated Itinerary')).toBeInTheDocument();
        });

        const checkButton = screen.getByText('Run Logistics Check');
        fireEvent.click(checkButton);

        // Since checkLogistics calls a cloud function which we have verified mocks for,
        // we mainly check the button state change or resulting toast/UI update.
        // In the mock implementation of RoadManager (not shown in full here but inferred), 
        // it updates state based on the report.

        await waitFor(() => {
            expect(screen.getByText('Logistics Verified')).toBeInTheDocument();
        });
    });

    it('updates the selected same-day stop by stable id instead of the first matching date', async () => {
        const setCurrentItineraryMock = vi.fn();
        const updateItineraryStopMock = vi.fn().mockResolvedValue(undefined);

        setupTouringMock({
            currentItinerary: {
                id: 'itinerary-123',
                tourName: 'Test Tour',
                stops: [
                    {
                        id: 'stop-1',
                        date: '2023-10-01',
                        city: 'Detroit',
                        venue: 'Club A',
                        activity: 'Travel',
                        notes: ''
                    },
                    {
                        id: 'stop-2',
                        date: '2023-10-01',
                        city: 'Chicago',
                        venue: 'Club B',
                        activity: 'Show',
                        notes: ''
                    }
                ],
                totalDistance: '300 miles',
                estimatedBudget: '$50'
            },
            setCurrentItinerary: setCurrentItineraryMock,
            updateItineraryStop: updateItineraryStopMock,
        });

        render(<RoadManager />);

        await waitFor(() => {
            expect(screen.getByText('Generated Itinerary')).toBeInTheDocument();
        });

        const editButtons = screen.getAllByText('Edit');
        fireEvent.click(editButtons[1]!);

        fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Milwaukee' } });
        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => {
            expect(updateItineraryStopMock).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    id: 'stop-2',
                    date: '2023-10-01',
                    city: 'Milwaukee',
                })
            );
        });

        expect(setCurrentItineraryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                stops: [
                    expect.objectContaining({ id: 'stop-1', city: 'Detroit' }),
                    expect.objectContaining({ id: 'stop-2', city: 'Milwaukee' }),
                ]
            })
        );
    });
});
