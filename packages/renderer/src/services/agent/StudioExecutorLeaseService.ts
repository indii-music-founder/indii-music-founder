import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

const KEYCHAIN_ID = 'studio-executor-enrollment-v1';

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

/** Electron-only bridge for a server-issued Studio executor lease. */
class StudioExecutorLeaseService {
    private cached: StudioExecutorLease | null = null;

    async getLease(): Promise<StudioExecutorLease> {
        if (this.cached && this.cached.expiresAt - Date.now() > 60_000) return this.cached;
        const credentials = window.electronAPI?.credentials;
        if (!credentials) throw new Error('Studio executor leases can only be issued inside the Electron Studio app.');
        const stored = await credentials.get(KEYCHAIN_ID) as { apiKey?: string; apiSecret?: string } | null;
        let deviceId = stored?.apiKey;
        let enrollmentSecret = stored?.apiSecret;
        if (!deviceId || !enrollmentSecret) {
            deviceId = crypto.randomUUID().replace(/-/g, '');
            enrollmentSecret = randomToken();
            await credentials.save(KEYCHAIN_ID, { apiKey: deviceId, apiSecret: enrollmentSecret });
        }
        const issue = httpsCallable<{ deviceId: string; enrollmentSecret: string }, StudioExecutorLease>(functions, 'issueStudioExecutorLease');
        const result = await issue({ deviceId, enrollmentSecret });
        this.cached = result.data;
        return result.data;
    }

    async publishPresence(state: Record<string, unknown>): Promise<void> {
        const lease = await this.getLease();
        const publish = httpsCallable(functions, 'publishStudioPresence');
        await publish({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, state });
    }

    async releasePresence(studioInstanceId: string): Promise<void> {
        const lease = await this.getLease();
        const release = httpsCallable(functions, 'releaseStudioPresence');
        await release({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, studioInstanceId });
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

    async publishResponse(response: { commandId: string; text: string; agentId?: string; imageUrls?: string[]; isStreaming: boolean; boardroomMessageId?: string }): Promise<void> {
        const lease = await this.getLease();
        const publish = httpsCallable(functions, 'publishStudioResponse');
        await publish({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, ...response });
    }

    async completeCommand(commandId: string): Promise<void> {
        const lease = await this.getLease();
        const complete = httpsCallable(functions, 'completeStudioCommand');
        await complete({ deviceId: lease.deviceId, leaseToken: lease.leaseToken, commandId });
    }
}

export const studioExecutorLeaseService = new StudioExecutorLeaseService();
