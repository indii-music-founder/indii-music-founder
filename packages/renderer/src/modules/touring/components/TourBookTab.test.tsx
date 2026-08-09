import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TourBookTab } from './TourBookTab';
import type { Itinerary } from '../types';

const { mockSend, mockSuccess, mockError } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockSuccess: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: mockSuccess, error: mockError }),
}));

vi.mock('@/services/email/ResendEmailService', () => ({
    ResendEmailService: { send: mockSend },
}));

function filterMotionProps(props: Record<string, unknown>): Record<string, unknown> {
    const { initial: _initial, animate: _animate, transition: _transition, ...domProps } = props;
    return domProps;
}

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...filterMotionProps(props)}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./DaySheetModal', () => ({ DaySheetModal: () => null }));
vi.mock('./TechnicalRiderGenerator', () => ({ TechnicalRiderGenerator: () => null }));
vi.mock('./VisaChecklist', () => ({ VisaChecklist: () => null }));

function makeItinerary(email?: string): Itinerary {
    return {
        id: 'itinerary-1',
        userId: 'user-1',
        tourName: 'Truth Tour',
        totalDistance: '300 miles',
        stops: [{
            id: 'stop-1',
            date: '2026-08-20',
            city: 'Detroit',
            venue: 'Fox Theatre',
            activity: 'Show',
            notes: '',
            contacts: [{ role: 'Promoter', name: 'Pat Promoter', phone: '313-555-0100', email }],
        }],
    };
}

function openStopAndSend(itinerary: Itinerary) {
    render(<TourBookTab itinerary={itinerary} onUpdateStop={vi.fn()} />);
    fireEvent.click(screen.getByText('Detroit'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Advance Email' }));
}

describe('TourBookTab advance email', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requires a real promoter email instead of using the contact name', () => {
        openStopAndSend(makeItinerary());

        expect(mockSend).not.toHaveBeenCalled();
        expect(mockError).toHaveBeenCalledWith('Add a valid Promoter email in the day sheet before sending');
        expect(mockSuccess).not.toHaveBeenCalled();
    });

    it('does not report success when the email provider rejects delivery', async () => {
        mockSend.mockResolvedValue({ success: false, error: 'Recipient rejected' });
        openStopAndSend(makeItinerary('promoter@example.com'));

        await waitFor(() => {
            expect(mockError).toHaveBeenCalledWith('Recipient rejected');
        });
        expect(mockSuccess).not.toHaveBeenCalled();
    });

    it('reports the actual recipient only after the provider accepts the email', async () => {
        mockSend.mockResolvedValue({ success: true, messageId: 'email-1' });
        openStopAndSend(makeItinerary('promoter@example.com'));

        await waitFor(() => {
            expect(mockSuccess).toHaveBeenCalledWith('Advance email sent to promoter@example.com');
        });
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            to: 'promoter@example.com',
            subject: 'Advance Information - Fox Theatre on 8/20/2026',
        }));
        expect(screen.getByText('Thu, Aug 20')).toBeInTheDocument();
    });
});
