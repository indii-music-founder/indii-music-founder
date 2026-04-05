import { useState, useEffect } from 'react';
import { getNetworkQuality, getNetworkConnection, type NetworkEffectiveType } from '@/lib/mobile';

interface NetworkQualityState {
    effectiveType: NetworkEffectiveType;
    isLowBandwidth: boolean;
    saveData: boolean;
}

/**
 * Hook to detect network quality and bandwidth saving mode
 * Useful for Adaptive Loading (disabling heavy animations, loading lower res images)
 */
export const useNetworkQuality = (): NetworkQualityState => {
    const [quality, setQuality] = useState<NetworkQualityState>({
        effectiveType: '4g', // Default to optimistic
        isLowBandwidth: false,
        saveData: false,
    });

    useEffect(() => {
        const connection = getNetworkConnection();

        const updateQuality = () => {
            const effectiveType = getNetworkQuality();
            // Check for saveData but safely handle if connection object or property is missing
            const connectionObj = getNetworkConnection();
            const saveData = connectionObj?.saveData === true;

            setQuality({
                effectiveType,
                // Treat slow-2g, 2g, or Data Saver mode as low bandwidth
                isLowBandwidth: effectiveType === 'slow-2g' || effectiveType === '2g' || saveData,
                saveData,
            });
        };

        // Initial check
        updateQuality();

        // Listen for changes if supported
        if (connection) {
            connection.addEventListener('change', updateQuality);
            return () => connection.removeEventListener('change', updateQuality);
        }
    }, []);

    return quality;
};
