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

vi.mock('@/services/firebase', () => ({
    functions: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(async () => ({
        data: {
            tourName: 'Route Draft',
            totalDistanceMiles: 314,
            estimatedBudget: 12000,
            stops: [
                {
                    date: '2026-07-03',
                    city: 'New York',
                    venue: 'MSG',
                    activity: 'Show',
                    notes: '',
                    type: 'Show',
                },
                {
                    date: '2026-07-04',
                    city: 'Chicago',
                    venue: 'Aragon Ballroom',
                    activity: 'Show',
                    notes: '',
                    type: 'Show',
                },
            ],
        },
    }))),
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
    });

    it('builds an itinerary from the selected route and saves it', async () => {
        render(<TourRouteOptimizer />);

        fireEvent.click(screen.getByRole('button', { name: /new york 1\.4m/i }));
        fireEvent.click(screen.getByRole('button', { name: /chicago 890k/i }));
        fireEvent.click(screen.getByRole('button', { name: /optimize route/i }));
        expect(screen.getByTestId('tour-map')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /build itinerary from route/i }));

        await waitFor(() => {
            expect(mockSaveItinerary).toHaveBeenCalledTimes(1);
        });

        expect(mockSaveItinerary).toHaveBeenCalledWith(expect.objectContaining({
            tourName: 'Route Draft',
            totalDistance: '314 miles',
            estimatedBudget: '12000',
            stops: expect.arrayContaining([
                expect.objectContaining({
                    id: expect.any(String),
                    city: 'New York',
                }),
                expect.objectContaining({
                    id: expect.any(String),
                    city: 'Chicago',
                }),
            ]),
        }));

        expect(mockSuccess).toHaveBeenCalledWith('Route itinerary saved');
    });
});
