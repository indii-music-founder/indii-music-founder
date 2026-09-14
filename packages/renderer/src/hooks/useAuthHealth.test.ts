import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthHealth } from './useAuthHealth';
import { events } from '@/core/events';

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: {
            getIdToken: vi.fn(),
        },
    },
}));

vi.mock('@/core/events', () => ({
    events: {
        emit: vi.fn(),
    },
}));

describe('useAuthHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('validates auth token with forceRefresh=false', async () => {
        const { auth } = await import('@/services/firebase');
        (auth.currentUser!.getIdToken as any).mockResolvedValue('valid-token');

        renderHook(() => useAuthHealth(60000));

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(auth.currentUser!.getIdToken).toHaveBeenCalledWith(false);
        expect(events.emit).not.toHaveBeenCalled();
    });

    it('does not emit SYSTEM_ALERT on transient network failure', async () => {
        const { auth } = await import('@/services/firebase');
        const networkError = new Error('network-request-failed');
        (networkError as any).code = 'auth/network-request-failed';
        (auth.currentUser!.getIdToken as any).mockRejectedValue(networkError);

        renderHook(() => useAuthHealth(60000));

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(auth.currentUser!.getIdToken).toHaveBeenCalledWith(false);
        expect(events.emit).not.toHaveBeenCalled();
    });

    it('emits SYSTEM_ALERT on session invalidation', async () => {
        const { auth } = await import('@/services/firebase');
        const sessionError = new Error('User token expired');
        (sessionError as any).code = 'auth/user-token-expired';
        (auth.currentUser!.getIdToken as any).mockRejectedValue(sessionError);

        renderHook(() => useAuthHealth(60000));

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(auth.currentUser!.getIdToken).toHaveBeenCalledWith(false);
        expect(events.emit).toHaveBeenCalledWith(
            'SYSTEM_ALERT',
            expect.objectContaining({
                level: 'warning',
                message: expect.stringContaining('session has expired'),
            })
        );
    });
});
