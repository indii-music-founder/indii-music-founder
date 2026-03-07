import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

/**
 * Requirement 165: Desktop App CPU Throttling
 * Hook to detect if the OS is running on battery (via Electron IPC) and
 * throttle heavy React/Three.js frame rates accordingly.
 */
export function usePowerMonitor() {
    const [isOnBattery, setIsOnBattery] = useState(false);

    useEffect(() => {
        // Safe check for Electron environment
        if (typeof window !== 'undefined' && (window as any).electron) {
            const electron = (window as any).electron;

            // Get initial state
            electron.ipcRenderer.invoke('power:get-state').then((state: string) => {
                setIsOnBattery(state === 'battery');
            }).catch((e: Error) => logger.warn('[usePowerMonitor] Failed to get initial power state', e));

            // Listen for changes
            const handleBattery = () => {
                logger.info('[usePowerMonitor] Switching to Battery Mode: Throttling heavy UI.');
                setIsOnBattery(true);
            };

            const handleAC = () => {
                logger.info('[usePowerMonitor] Switching to AC Mode: Restoring full UI performance.');
                setIsOnBattery(false);
            };

            electron.ipcRenderer.on('power:on-battery', handleBattery);
            electron.ipcRenderer.on('power:on-ac', handleAC);

            return () => {
                // Cleanup IPC listeners
                if (electron.ipcRenderer.removeListener) {
                    electron.ipcRenderer.removeListener('power:on-battery', handleBattery);
                    electron.ipcRenderer.removeListener('power:on-ac', handleAC);
                }
            };
        }
    }, []);

    // Return values to be passed into things like Three.js <Canvas frameloop={isOnBattery ? "demand" : "always"} />
    return {
        isOnBattery,
        frameloop: isOnBattery ? "demand" as const : "always" as const,
        animationQuality: isOnBattery ? "low" as const : "high" as const
    };
}