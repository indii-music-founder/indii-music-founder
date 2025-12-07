
import Store from 'electron-store';
import crypto from 'crypto';
import { authStorage } from './AuthStorage';
import fs from 'fs';

interface StoreSchema {
    [key: string]: any;
}

let store: Store<StoreSchema> | null = null;

export const secureStore = {
    init: async () => {
        try {
            // Derive encryption key from the secure token stored in Keychain
            const secret = await authStorage.getToken();

            // If no user is logged in, we can't encrypted with their secret.
            // Fallback to a device-specific key or just don't init secure store yet.
            if (!secret) {
                console.warn("[SecureStore] No auth secret found. Store not initialized.");
                return;
            }

            const encryptionKey = crypto.createHash('sha256').update(secret).digest('hex');

            store = new Store<StoreSchema>({
                encryptionKey, // Encrypts the JSON file on disk
                name: 'secure-vault'
            });

            console.log("[SecureStore] Initialized successfully.");
        } catch (error) {
            console.error("[SecureStore] Initialization failed:", error);
        }
    },

    get: (key: string) => {
        if (!store) throw new Error("Store not initialized");
        return store.get(key);
    },

    set: (key: string, val: any) => {
        if (!store) throw new Error("Store not initialized");
        store.set(key, val);
    },

    // HEY Audit Finding #10: Secure Deletion
    clear: () => {
        if (store) {
            const storePath = store.path;
            store.clear(); // Clear contents
            // Nuke file from disk
            if (fs.existsSync(storePath)) {
                fs.unlinkSync(storePath);
            }
            store = null;
        }
    }
};
