import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { logger } from '@/utils/logger';
import {
    recordPresencePublishAttempt,
    recordPresencePublishFailure,
    recordPresencePublishSuccess,
} from './studioRelayHealth';

const KEYCHAIN_ID = 'studio-executor-enrollment-v1';
export const REMOTE_RELAY_PROTOCOL_VERSION = 1;

export interface StudioExecutorLease {
    deviceId: string;
    leaseToken: string;
    expiresAt: number;
}

function randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Universal (Electron OS Keychain + Browser LocalStorage) bridge for a server-issued Studio executor lease. */
class StudioExecutorLeaseService {
    private cached: StudioExecutorLease | null = null;

    isSupported(): boolean {
        // Supported in Electron and any standard modern browser with crypto & storage
        return typeof window !== 'undefined' && (!!window.electronAPI?.credentials || typeof window.localStorage !== 'undefined');
    }

    async getLease(): Promise<StudioExecutorLease> {
        if (this.cached && this.cached.expiresAt - Date.now() > 60_000) return this.cached;

        let deviceId: string | undefined;
        let enrollmentSecret: string | undefined;

        const credentials = typeof window !== 'undefined' ? window.electronAPI?.credentials : undefined;
        if (credentials) {
            // Electron mode: OS Keychain persistence
            const stored = await credentials.get(KEYCHAIN_ID) as { apiKey?: string; apiSecret?: string } | null;
            deviceId = stored?.apiKey;
            enrollmentSecret = stored?.apiSecret;
            if (!deviceId || !enrollmentSecret) {
                deviceId = crypto.randomUUID().replace(/-/g, '');
                enrollmentSecret = randomToken();
                await credentials.save(KEYCHAIN_ID, { apiKey: deviceId, apiSecret: enrollmentSecret });
            }
        } else if (typeof window !== 'undefined' && window.localStorage) {
            // Browser mode: persistent browser-scoped device enrollment
            const rawStored = window.localStorage.getItem(KEYCHAIN_ID);
            if (rawStored) {
                try {
                    const parsed = JSON.parse(rawStored) as { apiKey?: string; apiSecret?: string };
                    deviceId = parsed?.apiKey;
                    enrollmentSecret = parsed?.apiSecret;
                } catch {
                    // Stale or invalid JSON, will re-enroll
                }
            }
            if (!deviceId || !enrollmentSecret) {
                deviceId = crypto.randomUUID().replace(/-/g, '');
                enrollmentSecret = randomToken();
                window.localStorage.setItem(KEYCHAIN_ID, JSON.stringify({ apiKey: deviceId, apiSecret: enrollmentSecret }));
            }
        } else {
            throw new Error('Studio executor leases require either the Electron Studio app or a supported browser with localStorage.');
        }

        const issue = httpsCallable<{ deviceId: string; enrollmentSecret: string }, StudioExecutorLease>(functions, 'issueStudioExecutorLease');
        const result = await issue({ deviceId, enrollmentSecret });
        this.cached = result.data;
        return result.data;
    }

    async publishPresence(state: Record<string, unknown>): Promise<void> {
        if (!this.isSupported()) {
            return;
        }
        // Record what the heartbeat loop actually observed so the Settings UI
        // can report real relay health instead of a structural capability
        // check. Errors re-throw — callers already handle them per beat.
        recordPresencePublishAttempt();
        try {
            const lease = await this.getLease();
            const publish = httpsCallable(functions, 'publishStudioPresence');
            await publish({
                deviceId: lease.deviceId,
                leaseToken: lease.leaseToken,
                protocolVersion: REMOTE_RELAY_PROTOCOL_VERSION,
                state,
            });
            recordPresencePublishSuccess();
        } catch (error) {
            recordPresencePublishFailure(error);
            throw error;
        }
    }

    async releasePresence(studioInstanceId: string): Promise<void> {
        if (!this.isSupported()) return;
        try {
            const lease = await this.getLease();
            const release = httpsCallable(functions, 'releaseStudioPresence');
            await release({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, studioInstanceId });
        } catch (error) {
            logger.warn('[StudioExecutorLeaseService] releasePresence failed:', error);
        }
    }

    async claimCommand(commandId: string, studioInstanceId: string): Promise<boolean> {
        const lease = await this.getLease();
        const claim = httpsCallable<
            { deviceId: string; leaseToken: string; commandId: string; studioInstanceId: string },
            { claimed: boolean }
        >(functions, 'claimStudioCommand');
        const result = await claim({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, commandId, studioInstanceId });
        return result.data.claimed;
    }

    async publishResponse(response: { commandId: string; text: string; agentId?: string; imageUrls?: string[]; videoUrls?: string[]; isStreaming: boolean; boardroomMessageId?: string }): Promise<void> {
        try {
            const lease = await this.getLease();
            const publish = httpsCallable(functions, 'publishStudioResponse');
            await publish({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, ...response });
        } catch (error) {
            logger.error(`[StudioExecutorLeaseService] publishResponse failed for ${response.commandId}:`, error);
            throw error;
        }
    }

    async completeCommand(commandId: string): Promise<void> {
        try {
            const lease = await this.getLease();
            const complete = httpsCallable(functions, 'completeStudioCommand');
            await complete({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, commandId });
        } catch (error) {
            logger.error(`[StudioExecutorLeaseService] completeCommand failed for ${commandId}:`, error);
            throw error;
        }
    }
}

export const studioExecutorLeaseService = new StudioExecutorLeaseService();
