import { StateStorage } from 'zustand/middleware';
import { logger } from '@/utils/logger';

/**
 * Custom storage adapter for Zustand persisted slices.
 * In Electron: Uses window.electronAPI.credentials (SafeStorage/Keytar) for encryption.
 * In Browser: Falls back to standard localStorage.
 * 
 * This satisfies PRODUCTION_100 Item 34: Secure Local Storage.
 */
export const SecureZustandStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            // Check if running in Electron with the credentials API available
            if (window.electronAPI?.credentials) {
                const creds = await window.electronAPI.credentials.get(name);
                if (creds && creds.payload) {
                    return creds.payload;
                }
                return null;
            }

            // Fallback to standard localStorage
            return localStorage.getItem(name);
        } catch (error) {
            logger.error(`[SecureStorage] Failed to get item "${name}":`, error);
            return null;
        }
    },

    setItem: async (name: string, value: string): Promise<void> => {
        try {
            if (window.electronAPI?.credentials) {
                // We wrap the JSON string in a standard Credentials object
                // The Electron main process handles the encryption via safeStorage/keytar
                await window.electronAPI.credentials.save(name, {
                    payload: value,
                    updatedAt: new Date().toISOString()
                });
                return;
            }

            localStorage.setItem(name, value);
        } catch (error) {
            logger.error(`[SecureStorage] Failed to set item "${name}":`, error);
        }
    },

    removeItem: async (name: string): Promise<void> => {
        try {
            if (window.electronAPI?.credentials) {
                await window.electronAPI.credentials.delete(name);
                return;
            }

            localStorage.removeItem(name);
        } catch (error) {
            logger.error(`[SecureStorage] Failed to remove item "${name}":`, error);
        }
    }
};
