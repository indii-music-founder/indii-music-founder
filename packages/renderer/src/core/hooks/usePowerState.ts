import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

export type PowerState = 'ac' | 'battery';

export const usePowerState = () => {
    const [state, setState] = useState<PowerState>('ac');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const api = window.electronAPI;
        if (!api?.power) return;

        let cancelled = false;
        let receivedLiveEvent = false;

        // Listen for changes before reading initial state so live transitions win
        const unsubBattery = api.power.onBattery(() => {
            receivedLiveEvent = true;
            logger.info('[PowerState] Switched to BATTERY. Throttling animations.');
            setState('battery');
        });

        const unsubAC = api.power.onAC(() => {
            receivedLiveEvent = true;
            logger.info('[PowerState] Switched to AC. Restoring full performance.');
            setState('ac');
        });

        // Get initial state
        api.power.getState().then((initialState) => {
            if (!cancelled && !receivedLiveEvent && (initialState === 'ac' || initialState === 'battery')) {
                setState(initialState);
            }
        }).catch((err: Error) => logger.error('[PowerState] Failed to get initial state:', err));

        return () => {
            cancelled = true;
            unsubBattery();
            unsubAC();
        };
    }, []);

    const isThrottled = state === 'battery';

    return { state, isThrottled };
};
