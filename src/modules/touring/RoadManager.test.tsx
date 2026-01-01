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
}));

// Mock useTouring hook
vi.mock('./hooks/useTouring', () => ({
    useTouring: vi.fn(),
}));

// Helper to setup the mock with default or custom values
const setupTouringMock = (overrides = {}) => {
    const defaultValues = {
        itineraries: [],
        currentItinerary: null,
        setCurrentItinerary: vi.fn(),
        saveItinerary: vi.fn().mockResolvedValue(undefined),
        updateItineraryStop: vi.fn(),
        vehicleStats: {
            milesDriven: 100,
            fuelLevelPercent: 75,
            tankSizeGallons: 20,
            mpg: 15,
            gasPricePerGallon: 4.00
        },
        saveVehicleStats: vi.fn().mockResolvedValue(undefined),
        loading: false,
    };
    vi.mocked(useTouring).mockReturnValue({ ...defaultValues, ...overrides });
};

vi.mock('firebase/functions', () => ({
    httpsCallable: (functionsInstance: any, name: string) => {
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
        expect(screen.getByText('Tour Details')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Add a city...')).toBeInTheDocument();
    });

    it('allows adding and removing locations', async () => {
        render(<RoadManager />);
        const input = screen.getByPlaceholderText('Add a city...');
        const addButton = screen.getByLabelText('Add location');

        fireEvent.change(input, { target: { value: 'New York' } });
        fireEvent.click(addButton);

        expect(screen.getByText('New York')).toBeInTheDocument();

        // Remove location
        // Remove location
        const removeButton = screen.getByLabelText('Remove New York');
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByText('New York')).not.toBeInTheDocument();
        });
    });

    it('allows adding and removing locations', async () => {
        render(<RoadManager />);
        const input = screen.getByPlaceholderText('Add a city...');
        const addButton = screen.getByLabelText('Add location');

        fireEvent.change(input, { target: { value: 'New York' } });
        fireEvent.click(addButton);

        expect(screen.getByText('New York')).toBeInTheDocument();

        // Remove location
        // Remove location
        const removeButton = screen.getByLabelText('Remove New York');
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByText('New York')).not.toBeInTheDocument();
        });
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
        const locationInput = screen.getByPlaceholderText('Add a city...');
        fireEvent.change(locationInput, { target: { value: 'New York' } });
        fireEvent.keyDown(locationInput, { key: 'Enter', code: 'Enter' });

        // Wait for location to appear
        await waitFor(() => {
            expect(screen.getByText('New York')).toBeInTheDocument();
        });

        const generateButton = screen.getByText('Launch Route Generator');
        expect(generateButton).not.toBeDisabled();

        fireEvent.click(generateButton);

        // Check for loading state
        expect(screen.getByText('Synchronizing...')).toBeInTheDocument();

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
                stops: [],
                totalDistance: '1000 km',
                estimatedBudget: '$50'
            }
        });

        render(<RoadManager />);

        // We don't need to interact to generate, just check logistics directly if button is enabled/visible
        // But the check button calls handleCheckLogistics which guards on !itinerary

        // Use the Planning tab default view

        // If itinerary is present, PlanningTab might show the itinerary details directly?
        // Let's assume the UI shows the "Check Logistics" button when itinerary exists or we can just trigger it.
        // Actually, PlanningTab shows "Active Itinerary" if `itinerary` prop is set.

        expect(screen.getByText('Test Tour')).toBeInTheDocument();

        const checkButton = screen.getByText('Check Logistics');
        fireEvent.click(checkButton);

        await waitFor(() => {
            expect(screen.getByText('Feasibility Report')).toBeInTheDocument();
            expect(screen.getByText('Looks good')).toBeInTheDocument();
        });
    });
});
