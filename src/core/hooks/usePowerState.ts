import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

export type PowerState = 'ac' | 'battery';

export const usePowerState = () => {
    const [state, setState] = useState<PowerState>('ac');

    useEffect(() => {
        // @ts-ignore
        if (!window.electronAPI?.on) return;

        // Get initial state
        // @ts-ignore
        window.electronAPI.invoke?.('power:get-state').then((initialState: PowerState) => {
            setState(initialState);
        }).catch((err: Error) => logger.error('[PowerState] Failed to get initial state:', err));

        // Listen for changes
        // @ts-ignore
        const unsubBattery = window.electronAPI.on('power:on-battery', () => {
            logger.info('[PowerState] Switched to BATTERY. Throttling animations.');
            setState('battery');
        });

        // @ts-ignore
        const unsubAC = window.electronAPI.on('power:on-ac', () => {
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
