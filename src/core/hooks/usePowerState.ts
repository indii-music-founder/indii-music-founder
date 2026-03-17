import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

export type PowerState = 'ac' | 'battery';

export const usePowerState = () => {
    const [state, setState] = useState<PowerState>('ac');

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.on) return;

        // Get initial state
        api.invoke('power:get-state').then((initialState) => {
            setState(initialState as PowerState);
        }).catch((err: Error) => logger.error('[PowerState] Failed to get initial state:', err));

        // Listen for changes
        const unsubBattery = api.on('power:on-battery', () => {
            logger.info('[PowerState] Switched to BATTERY. Throttling animations.');
            setState('battery');
        });

        const unsubAC = api.on('power:on-ac', () => {
            logger.info('[PowerState] Switched to AC. Restoring full performance.');
            setState('ac');
        });

        return () => {
            unsubBattery();
            unsubAC();
        };
    }, []);

    const isThrottled = state === 'battery';

    return { state, isThrottled };
};
