import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutomationSection from './AutomationSection';
import { DEFAULT_ARTIST_OPERATING_PROFILE } from '@shared';

const showToast = vi.fn();
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

let currentProfile = DEFAULT_ARTIST_OPERATING_PROFILE;
const mockOnProfileChange = vi.fn((cb: (p: typeof DEFAULT_ARTIST_OPERATING_PROFILE) => void) => {
    cb(currentProfile);
    return () => {};
});
const mockUpdateProfile = vi.fn();
vi.mock('@/services/agent/governance/ArtistOperatingProfileService', () => ({
    artistOperatingProfileService: {
        onProfileChange: (cb: (p: typeof DEFAULT_ARTIST_OPERATING_PROFILE) => void) => mockOnProfileChange(cb),
        updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    },
}));

describe('AutomationSection — Artist Operating Profile (ISSUE-1172)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentProfile = DEFAULT_ARTIST_OPERATING_PROFILE;
        mockOnProfileChange.mockImplementation((cb) => {
            cb(currentProfile);
            return () => {};
        });
        mockUpdateProfile.mockResolvedValue({
            ...DEFAULT_ARTIST_OPERATING_PROFILE,
            permissions: { ...DEFAULT_ARTIST_OPERATING_PROFILE.permissions, autonomousComputerControl: true },
        });
    });

    it('renders opted-out by default (fail-closed)', async () => {
        render(<AutomationSection />);
        expect(await screen.findByText('Autonomous Computer Control')).toBeInTheDocument();
        const toggle = screen.getAllByRole('button')[0];
        expect(toggle).toBeInTheDocument();
    });

    it('toggles Autonomous Computer Control on and persists via updateProfile', async () => {
        render(<AutomationSection />);
        await screen.findByText('Autonomous Computer Control');

        const rows = screen.getAllByText(/Autonomous Computer Control|Allow Destructive Tools/);
        expect(rows.length).toBeGreaterThan(0);

        // Click the first toggle button in the settings rows
        const toggleButtons = document.querySelectorAll('button.relative.inline-flex');
        fireEvent.click(toggleButtons[0]);

        await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ permissions: expect.objectContaining({ autonomousComputerControl: true }) }),
        ));
    });

    it('adds a business goal via the list editor', async () => {
        render(<AutomationSection />);
        await screen.findByText('Business Goals');

        const input = screen.getByPlaceholderText('e.g. Grow email list before next release');
        fireEvent.change(input, { target: { value: 'Grow email list' } });
        fireEvent.click(screen.getByLabelText('Add to Business Goals'));

        await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ businessGoals: ['Grow email list'] }));
    });

    it('shows an error toast when persisting fails', async () => {
        mockUpdateProfile.mockRejectedValueOnce(new Error('Not authenticated — cannot update Artist Operating Profile'));
        render(<AutomationSection />);
        await screen.findByText('Business Goals');

        const input = screen.getByPlaceholderText('e.g. Grow email list before next release');
        fireEvent.change(input, { target: { value: 'Grow email list' } });
        fireEvent.click(screen.getByLabelText('Add to Business Goals'));

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Not authenticated — cannot update Artist Operating Profile', 'error'));
    });

    it('removes a creative boundary', async () => {
        currentProfile = {
            ...DEFAULT_ARTIST_OPERATING_PROFILE,
            creativeBoundaries: ['Never post without review'],
        };
        mockUpdateProfile.mockResolvedValueOnce({ ...currentProfile, creativeBoundaries: [] });
        render(<AutomationSection />);

        const removeButton = await screen.findByLabelText('Remove Never post without review from Creative Boundaries');
        fireEvent.click(removeButton);

        await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ creativeBoundaries: [] }));
    });
});
