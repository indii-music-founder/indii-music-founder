
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ReleaseWizard from './ReleaseWizard';
import { useDDEXRelease } from '../hooks/useDDEXRelease';

// Mock the hook
vi.mock('../hooks/useDDEXRelease');

describe('ReleaseWizard Integration', () => {
    const mockUpdateMetadata = vi.fn();
    const mockGoToNextStep = vi.fn();

    const defaultHookValues = {
        currentStep: 'metadata',
        metadata: {
            trackTitle: '',
            artistName: '',
            genre: '',
            releaseDate: '',
            labelName: ''
        },
        updateMetadata: mockUpdateMetadata,
        isStepValid: vi.fn(),
        validationErrors: [],
        goToNextStep: mockGoToNextStep,
        canGoNext: true,
        selectedDistributors: [],
        assets: {},
        uploadProgress: {}
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useDDEXRelease as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultHookValues);
    });

    it('renders metadata fields correctly', () => {
        render(<ReleaseWizard />);

        expect(screen.getByLabelText(/Track Title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Artist Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Genre/i)).toBeInTheDocument();
    });

    it('updates metadata when user types', () => {
        render(<ReleaseWizard />);

        const titleInput = screen.getByLabelText(/Track Title/i);
        fireEvent.change(titleInput, { target: { value: 'Black Kitty' } });

        expect(mockUpdateMetadata).toHaveBeenCalledWith({ trackTitle: 'Black Kitty' });
    });

    it('updates genre selection', () => {
        render(<ReleaseWizard />);

        const genreSelect = screen.getByRole('combobox', { name: /Genre/i }); // Assuming label association or implicit role
        // Fallback if role lookup is tricky with the custom UI:
        // const genreSelect = container.querySelector('select'); 

        fireEvent.change(genreSelect, { target: { value: 'Electronic' } });

        expect(mockUpdateMetadata).toHaveBeenCalledWith({ genre: 'Electronic' });
    });

    it('validates required fields prevents navigation', () => {
        // Setup hook to return false for valid
        (useDDEXRelease as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultHookValues,
            isStepValid: vi.fn((stepId) => stepId !== 'metadata'), // metadata invalid
            canGoNext: false
        });

        render(<ReleaseWizard />);

        const nextButton = screen.getByRole('button', { name: /Next/i });
        expect(nextButton).toBeDisabled();
    });

    it('navigates to distribution step and permits selection', () => {
        const mockToggleDistributor = vi.fn();
        (useDDEXRelease as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultHookValues,
            currentStep: 'distribution', // Force step
            toggleDistributor: mockToggleDistributor,
            selectedDistributors: []
        });

        render(<ReleaseWizard />);

        expect(screen.getByText(/Select Distributors/i)).toBeInTheDocument();

        const spotifyButton = screen.getByText(/DistroKid/i); // Using DistroKid as proxy
        fireEvent.click(spotifyButton);

        expect(mockToggleDistributor).toHaveBeenCalledWith('distrokid');
    });

    it('renders review step with correct summary', () => {
        (useDDEXRelease as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultHookValues,
            currentStep: 'review',
            metadata: {
                trackTitle: 'Test Song',
                artistName: 'Test Artist',
                genre: 'Pop'
            },
            assets: {
                audioFile: { format: 'wav', sizeBytes: 1000, url: 'mock' }
            },
            selectedDistributors: ['distrokid']
        });

        render(<ReleaseWizard />);

        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Test Artist')).toBeInTheDocument();
        expect(screen.getByText(/DistroKid/i)).toBeInTheDocument();
        expect(screen.getAllByText(/WAV/i)[0]).toBeInTheDocument();
    });

    // ISSUE-1440: optional identifier fields are secondaries — they must stay
    // collapsed out of the required grid until the user asks for them.
    it('keeps Advanced metadata collapsed until opened', () => {
        render(<ReleaseWizard />);

        const toggle = screen.getByRole('button', { name: /Advanced metadata/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        // Field labels were never programmatically associated with their inputs
        // (pre-existing), so assert on the label text instead of getByLabelText.
        expect(screen.queryByText('ISRC code')).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('ISRC code')).toBeInTheDocument();
    });

    it('shows the territory multi-select trigger with selection count (ISSUE-1440)', () => {
        (useDDEXRelease as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultHookValues,
            currentStep: 'distribution',
            toggleDistributor: vi.fn(),
            selectedDistributors: [],
            metadata: { ...defaultHookValues.metadata, territories: ['US', 'CA'] }
        });

        render(<ReleaseWizard />);

        expect(screen.getByTestId('territories-select')).toHaveTextContent('2 territories selected');
    });

});
