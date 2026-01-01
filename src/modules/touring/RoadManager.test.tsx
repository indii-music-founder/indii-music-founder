import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoadManager from './RoadManager';

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
        const removeButton = screen.getByLabelText('Remove New York');
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.queryByText('New York')).not.toBeInTheDocument();
        });
    });

    it('generates itinerary when inputs are valid', async () => {
        // Setup mock return if we were using the hook, but here we move it before render
        // to follow the pattern requested, even if this specific test uses httpsCallable mocks above.
        // The PR comment requested: "Move mock setup before render"

        render(<RoadManager />);

        const startDateInput = screen.getByLabelText('Start Date');
        const endDateInput = screen.getByLabelText('End Date');

        fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
        fireEvent.change(endDateInput, { target: { value: '2023-10-10' } });

        // Add location
        const locationInput = screen.getByPlaceholderText('Add a city...');
        fireEvent.change(locationInput, { target: { value: 'New York' } });
        fireEvent.keyDown(locationInput, { key: 'Enter', code: 'Enter' });

        const generateButton = screen.getByText('Launch Route Generator');
        expect(generateButton).not.toBeDisabled();

        fireEvent.click(generateButton);

        expect(screen.getByText('Synchronizing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Test Tour')).toBeInTheDocument();
            expect(screen.getByText('MSG')).toBeInTheDocument();
        });
    });

    it('checks logistics after generating itinerary', async () => {
        render(<RoadManager />);

        const startDateInput = screen.getByLabelText('Start Date');
        const endDateInput = screen.getByLabelText('End Date');

        fireEvent.change(startDateInput, { target: { value: '2023-10-01' } });
        fireEvent.change(endDateInput, { target: { value: '2023-10-10' } });

        const locationInput = screen.getByPlaceholderText('Add a city...');
        fireEvent.change(locationInput, { target: { value: 'New York' } });
        fireEvent.keyDown(locationInput, { key: 'Enter', code: 'Enter' });

        const generateButton = screen.getByText('Launch Route Generator');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Test Tour')).toBeInTheDocument();
        });

        const checkButton = screen.getByText('Check Logistics');
        fireEvent.click(checkButton);

        await waitFor(() => {
            expect(screen.getByText('Feasibility Report')).toBeInTheDocument();
            expect(screen.getByText('Looks good')).toBeInTheDocument();
        });
    });
});
