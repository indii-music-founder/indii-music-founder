import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePowerState } from './usePowerState';

describe('usePowerState', () => {
    const originalElectronAPI = window.electronAPI;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        window.electronAPI = originalElectronAPI;
    });

    it('defaults to ac when electronAPI.power is unavailable', () => {
        window.electronAPI = undefined;
        const { result } = renderHook(() => usePowerState());
        expect(result.current.state).toBe('ac');
        expect(result.current.isThrottled).toBe(false);
    });

    it('does not let stale getState() overwrite an earlier live battery event', async () => {
        let resolveInitial!: (value: 'ac' | 'battery') => void;
        let batteryHandler: (() => void) | undefined;
        const unsubBattery = vi.fn();
        const unsubAC = vi.fn();

        window.electronAPI = {
            power: {
                getState: vi.fn(
                    () =>
                        new Promise<'ac' | 'battery'>((resolve) => {
                            resolveInitial = resolve;
                        })
                ),
                onBattery: vi.fn((cb: () => void) => {
                    batteryHandler = cb;
                    return unsubBattery;
                }),
                onAC: vi.fn(() => unsubAC),
            },
        } as unknown as typeof window.electronAPI;

        const { result, unmount } = renderHook(() => usePowerState());

        act(() => {
            batteryHandler?.();
        });
        expect(result.current.state).toBe('battery');
        expect(result.current.isThrottled).toBe(true);

        // Stale initial state resolves after live battery event
        await act(async () => {
            resolveInitial('ac');
        });
        expect(result.current.state).toBe('battery');

        unmount();
        expect(unsubBattery).toHaveBeenCalledTimes(1);
        expect(unsubAC).toHaveBeenCalledTimes(1);
    });

    it('applies initial state when no live event arrived first', async () => {
        window.electronAPI = {
            power: {
                getState: vi.fn().mockResolvedValue('battery'),
                onBattery: vi.fn(() => vi.fn()),
                onAC: vi.fn(() => vi.fn()),
            },
        } as unknown as typeof window.electronAPI;

        const { result } = renderHook(() => usePowerState());

        await waitFor(() => {
            expect(result.current.state).toBe('battery');
        });
        expect(result.current.isThrottled).toBe(true);
    });
});
