import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, app } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Requirement 168: Cross-Device Handoff
 * Syncs the user's active UI state to Firestore, allowing them to resume exactly
 * where they left off on another device (e.g. Mobile -> Desktop).
 */

export interface HandoffState {
    activeRoute: string;
    activeAgentId?: string;
    draftInput?: string;
    timestamp: number;
    deviceId: string;
}

export class HandoffService {
    private syncTimeout: NodeJS.Timeout | null = null;
    private currentDeviceId: string;

    constructor() {
        // Generate a pseudo-unique ID for this specific browser/app instance session
        this.currentDeviceId = `dev_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Debounces and syncs the current UI state to the user's cloud profile.
     */
    public syncState(state: Omit<HandoffState, 'timestamp' | 'deviceId'>) {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        this.syncTimeout = setTimeout(async () => {
            const auth = getAuth(app);
            const user = auth.currentUser;
            if (!user) return;

            try {
                const payload: HandoffState = {
                    ...state,
                    timestamp: Date.now(),
                    deviceId: this.currentDeviceId
                };

                await setDoc(doc(db, 'users', user.uid, 'settings', 'handoff'), payload, { merge: true });
                logger.debug('[HandoffService] Synced active state to cloud.');
            } catch (error) {
                logger.error('[HandoffService] Failed to sync handoff state', error);
            }
        }, 1500); // Debounce 1.5s
    }

    /**
     * Listens for remote handoff events. If a newer state comes in from a DIFFERENT device,
     * it triggers the callback to prompt the user to "Resume Session".
     */
    public listenForRemoteHandoff(callback: (state: HandoffState) => void): () => void {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) return () => {};

        return onSnapshot(doc(db, 'users', user.uid, 'settings', 'handoff'), (snapshot) => {
            if (snapshot.exists()) {
                const state = snapshot.data() as HandoffState;

                // Only trigger if the update came from a different device and is recent (last 5 mins)
                if (state.deviceId !== this.currentDeviceId && (Date.now() - state.timestamp < 300000)) {
                    logger.info(`[HandoffService] Remote handoff detected from ${state.deviceId}`);
                    callback(state);
                }
            }
        });
    }

    /**
     * Retrieves the last known state manually on fresh load.
     */
    public async getInitialHandoffState(): Promise<HandoffState | null> {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) return null;

        try {
            const snapshot = await getDoc(doc(db, 'users', user.uid, 'settings', 'handoff'));
            if (snapshot.exists()) {
                return snapshot.data() as HandoffState;
            }
        } catch (error) {
            logger.error('[HandoffService] Failed to retrieve handoff state', error);
        }
        return null;
    }
}

export const handoffService = new HandoffService();