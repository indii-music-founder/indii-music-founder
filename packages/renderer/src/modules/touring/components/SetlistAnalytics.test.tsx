import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SetlistAnalytics } from './SetlistAnalytics';
import type { SetlistDraft } from '@/services/touring/SetlistDraftService';

const mocks = vi.hoisted(() => ({
    storeState: {
        userProfile: { id: 'user-1' } as Record<string, unknown> | null,
    },
    auth: { currentUser: { uid: 'user-1' } as { uid: string } | null },
    create: vi.fn(),
    delete: vi.fn(),
    subscribe: vi.fn(),
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
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
}));
vi.mock('@/services/firebase', () => ({ auth: mocks.auth }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }));
vi.mock('@/services/touring/SetlistDraftService', () => ({
    setlistDraftService: {
        create: mocks.create,
        delete: mocks.delete,
        subscribe: mocks.subscribe,
    },
}));

const savedDraft: SetlistDraft = {
    id: 'draft-1',
    userId: 'user-1',
    venue: 'Test Venue',
    date: '2099-08-09',
    city: 'Detroit',
    attendance: 250,
    category: 'original',
    status: 'draft_requires_manual_filing',
    songs: [{ id: 'song-1', title: 'Test Song', originalArtist: '', type: 'original' }],
};

function fillDraftForm() {
    const venueInput = screen.getByText('Venue Name').nextElementSibling as HTMLInputElement;
    const dateInput = screen.getByText('Date').nextElementSibling as HTMLInputElement;
    const cityInput = screen.getByText('City').nextElementSibling as HTMLInputElement;
    const attendanceInput = screen.getByText('Attendance').nextElementSibling as HTMLInputElement;

    fireEvent.change(venueInput, { target: { value: 'Test Venue' } });
    fireEvent.change(dateInput, { target: { value: '2099-08-09' } });
    fireEvent.change(cityInput, { target: { value: 'Detroit' } });
    fireEvent.change(attendanceInput, { target: { value: '250' } });
    fireEvent.change(screen.getByPlaceholderText('Song Title'), { target: { value: 'Test Song' } });
}

describe('SetlistAnalytics production contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.storeState.userProfile = { id: 'user-1' };
        mocks.auth.currentUser = { uid: 'user-1' };
        mocks.create.mockResolvedValue('draft-1');
        mocks.delete.mockResolvedValue(undefined);
        mocks.subscribe.mockImplementation((_userId, onData) => {
            onData([]);
            return vi.fn();
        });
    });

    it('presents saved drafts without a fabricated royalty estimate', () => {
        render(<SetlistAnalytics />);

        expect(screen.getByText('Performance Setlists')).toBeInTheDocument();
        expect(screen.getByText('Draft only — not filed with a PRO')).toBeInTheDocument();
        expect(screen.queryByText(/Estimated Payout|Estimated Royalties|IRS|\$\d/)).not.toBeInTheDocument();
    });

    it('saves the authenticated user draft through the wired service', async () => {
        render(<SetlistAnalytics />);
        fillDraftForm();
        fireEvent.click(screen.getByRole('button', { name: 'Save Setlist Draft' }));

        await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({
            userId: 'user-1',
            venue: 'Test Venue',
            date: '2099-08-09',
            city: 'Detroit',
            attendance: 250,
            category: 'original',
            songs: [expect.objectContaining({ title: 'Test Song', originalArtist: '', type: 'original' })],
        }));
        expect(mocks.toast.success).toHaveBeenCalledWith('Setlist draft saved');
    });

    it('retains entered data and reports a rejected draft write', async () => {
        mocks.create.mockRejectedValueOnce(new Error('Firestore denied'));
        render(<SetlistAnalytics />);
        fillDraftForm();
        fireEvent.click(screen.getByRole('button', { name: 'Save Setlist Draft' }));

        await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Setlist draft was not saved.'));
        expect(screen.getByDisplayValue('Test Venue')).toBeInTheDocument();
        expect(mocks.toast.success).not.toHaveBeenCalledWith('Setlist draft saved');
    });

    it('does not write a draft without an authenticated Firebase user', async () => {
        mocks.auth.currentUser = null;
        render(<SetlistAnalytics />);
        fillDraftForm();
        fireEvent.click(screen.getByRole('button', { name: 'Save Setlist Draft' }));

        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.toast.error).toHaveBeenCalledWith('Sign in to save setlist drafts.');
        expect(screen.getByDisplayValue('Test Venue')).toBeInTheDocument();
    });

    it('surfaces subscription failures instead of showing an empty history', async () => {
        mocks.subscribe.mockImplementation((_userId, _onData, onError) => {
            onError(new Error('Permission denied'));
            return vi.fn();
        });
        render(<SetlistAnalytics />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Saved setlist drafts could not be loaded.');
    });

    it('labels persisted records as unsubmitted drafts', () => {
        mocks.subscribe.mockImplementation((_userId, onData) => {
            onData([savedDraft]);
            return vi.fn();
        });
        render(<SetlistAnalytics />);

        expect(screen.getByText('Draft · Not submitted')).toBeInTheDocument();
        expect(screen.getByText('Recorded Attendance')).toBeInTheDocument();
        expect(screen.getByText('250')).toBeInTheDocument();
    });
});
