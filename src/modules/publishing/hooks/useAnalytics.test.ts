import { renderHook, act } from '@testing-library/react';
import { useAnalytics, usePayouts } from './useAnalytics';
import { useStore } from '@/core/store';
import { getFirestore, onSnapshot } from 'firebase/firestore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    Timestamp: {
        fromDate: vi.fn((date) => ({ toDate: () => date }))
    }
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('useAnalytics', () => {
    let mockUnsubscribe: ReturnType<typeof vi.fn>;
    let capturedOnNext: (payload: any) => void;
    let capturedOnError: (payload: any) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUnsubscribe = vi.fn();
        capturedOnNext = () => { };
        capturedOnError = () => { };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'test-user-id' });
        (getFirestore as ReturnType<typeof vi.fn>).mockReturnValue({});

        (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_query, onNext, onError) => {
            capturedOnNext = onNext;
            if (onError) capturedOnError = onError;
            return mockUnsubscribe;
        });
    });

    it('should return initial loading state and empty data', () => {
        const dateRange = { start: '2026-03-01', end: '2026-03-30' };
        const { result } = renderHook(() => useAnalytics(dateRange));

        expect(result.current.loading).toBe(true);
        expect(result.current.data).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it('should process a successful snapshot with data correctly', () => {
        const mockData = [
            {
                id: '2026-03-15',
                data: () => ({
                    date: { toDate: () => new Date('2026-03-15T00:00:00Z') },
                    streams: 1500,
                    revenue: 45.50
                })
            }
        ];

        const dateRange = { start: '2026-03-14', end: '2026-03-16' };
        const { result } = renderHook(() => useAnalytics(dateRange));

        act(() => {
            capturedOnNext({
                forEach: (cb: any) => mockData.forEach(doc => cb(doc))
            });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.data.length).toBe(3); // 3 days inclusive

        // March 15 should have the data
        const activeDay = result.current.data.find(d => d.date === '2026-03-15');
        expect(activeDay).toBeDefined();
        expect(activeDay?.streams).toBe(1500);
        expect(activeDay?.revenue).toBe(45.5);

        // Other days should be 0
        const emptyDay = result.current.data.find(d => d.date === '2026-03-14');
        expect(emptyDay?.streams).toBe(0);
    });

    it('should handle error from snapshot', () => {
        const dateRange = { start: '2026-03-01', end: '2026-03-30' };
        const { result } = renderHook(() => useAnalytics(dateRange));

        act(() => {
            capturedOnError(new Error('Firestore permission denied'));
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Firestore permission denied');
        expect(result.current.data).toEqual([]);
    });

    it('should unsubscribe on unmount', () => {
        const dateRange = { start: '2026-03-01', end: '2026-03-30' };
        const { unmount } = renderHook(() => useAnalytics(dateRange));

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
});

describe('usePayouts', () => {
    let mockUnsubscribe: ReturnType<typeof vi.fn>;
    let capturedOnNext: (payload?: any) => void;
    let capturedOnError: (payload?: any) => void;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUnsubscribe = vi.fn();
        capturedOnNext = () => { };
        capturedOnError = () => { };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'test-user-id' });
        (getFirestore as ReturnType<typeof vi.fn>).mockReturnValue({});

        (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_query, onNext, onError) => {
            capturedOnNext = onNext;
            if (onError) capturedOnError = onError;
            return mockUnsubscribe;
        });
    });

    it('should fetch payouts successfully', () => {
        const mockDoc = {
            id: 'payout-123',
            data: () => ({
                date: { toDate: () => new Date('2026-03-20T12:00:00Z') },
                amount: 1500.50,
                currencyCode: 'USD',
                status: 'paid',
                method: 'Bank Transfer',
                releases: []
            })
        };

        const { result } = renderHook(() => usePayouts());

        act(() => {
            capturedOnNext({
                empty: false,
                docs: [mockDoc]
            });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.payouts.length).toBe(1);
        expect(result.current.payouts[0]!.amount).toBe(1500.50);
        expect(result.current.payouts[0]!.id).toBe('payout-123');
    });

    it('should handle errors gracefully in payouts', () => {
        const { result } = renderHook(() => usePayouts());

        act(() => {
            capturedOnError(new Error('Failed to sync payouts'));
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Failed to sync payouts');
        expect(result.current.payouts).toEqual([]);
    });

    it('should handle manual refresh callback', () => {
        const { result } = renderHook(() => usePayouts());

        // Simulate initial empty snapshot delivery
        act(() => {
            capturedOnNext({ empty: true, docs: [] });
        });

        expect(result.current.loading).toBe(false);

        act(() => {
            result.current.refresh();
        });

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBeNull();
        expect(onSnapshot).toHaveBeenCalledTimes(2);
    });
});
