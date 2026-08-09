import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TourRouteOptimizer } from './TourRouteOptimizer';

const { mockSaveItinerary, mockSuccess, mockError } = vi.hoisted(() => ({
    mockSaveItinerary: vi.fn(),
    mockSuccess: vi.fn(),
    mockError: vi.fn(),
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'transition', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: mockSuccess,
        error: mockError,
        info: vi.fn(),
    }),
}));

vi.mock('../hooks/useTouring', () => ({
    useTouring: () => ({
        saveItinerary: mockSaveItinerary,
    }),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
        button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...filterDomProps(props)}>{children}</button>,
        li: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <li {...filterDomProps(props)}>{children}</li>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/Modal', () => ({
    Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <>{children}</> : null),
}));

vi.mock('./TourMap', () => ({
    TourMap: () => <div data-testid="tour-map" />,
}));

describe('TourRouteOptimizer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSaveItinerary.mockResolvedValue(undefined);
    });

    it('saves a geography-only route draft without invented business data', async () => {
        render(<TourRouteOptimizer />);

        expect(screen.getByText(/does not include audience, venue, ticket-price, or revenue data/i)).toBeInTheDocument();
        expect(screen.queryByText('Reach')).not.toBeInTheDocument();
        expect(screen.queryByText('Est. Revenue')).not.toBeInTheDocument();
        expect(screen.queryByText(/Spotify/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /new york ny/i }));
        fireEvent.click(screen.getByRole('button', { name: /chicago il/i }));
        fireEvent.click(screen.getByRole('button', { name: /optimize route/i }));
        expect(screen.getByTestId('tour-map')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /save route draft/i }));

        await waitFor(() => {
            expect(mockSaveItinerary).toHaveBeenCalledTimes(1);
        });

        expect(mockSaveItinerary).toHaveBeenCalledWith(expect.objectContaining({
            tourName: 'Route draft: New York to Chicago',
            totalDistance: expect.stringMatching(/^\d+ miles straight-line$/),
            stops: expect.arrayContaining([
                expect.objectContaining({
                    id: expect.any(String),
                    city: 'New York, NY',
                    venue: '',
                    activity: 'Planning stop',
                    type: 'Planning',
                }),
                expect.objectContaining({
                    id: expect.any(String),
                    city: 'Chicago, IL',
                    venue: '',
                    activity: 'Planning stop',
                    type: 'Planning',
                }),
            ]),
        }));
        expect(mockSaveItinerary.mock.calls[0]?.[0]).not.toHaveProperty('estimatedBudget');

        expect(mockSuccess).toHaveBeenCalledWith('Route draft saved');
    });

    it('does not report success when route persistence fails', async () => {
        mockSaveItinerary.mockRejectedValueOnce(new Error('Firestore unavailable'));
        render(<TourRouteOptimizer />);

        fireEvent.click(screen.getByRole('button', { name: /new york ny/i }));
        fireEvent.click(screen.getByRole('button', { name: /chicago il/i }));
        fireEvent.click(screen.getByRole('button', { name: /save route draft/i }));

        await waitFor(() => {
            expect(mockError).toHaveBeenCalledWith('Failed to save route draft');
        });
        expect(mockSuccess).not.toHaveBeenCalled();
    });
});
