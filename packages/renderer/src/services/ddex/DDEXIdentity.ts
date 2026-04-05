import { DDEX_CONFIG } from '@/core/config/ddex';

/**
 * DDEX Identity Service
 * Manages DPIDs and Party IDs for the indiiOS distribution pipeline.
 *
 * DPIDs (DDEX Party IDs) are registered at https://dpid.ddex.net/
 * Each DSP has a unique DPID that must be used as the MessageRecipient.
 *
 * Production DPIDs are obtained during the onboarding process with each DSP.
 * The placeholder DPIDs below should be replaced with real values once onboarded.
 */

/** Known DSP recipient registry.
 *
 * These DPIDs are used as MessageRecipient in DDEX ERN messages.
 * Real DPIDs are obtained during the content provider onboarding
 * process with each DSP. Update these values when onboarding completes.
 *
 * Set via environment variables for deployment flexibility:
 *   VITE_DDEX_DPID_SPOTIFY, VITE_DDEX_DPID_APPLE, etc.
 */
const DSP_REGISTRY: Record<string, { dpid: string; name: string; protocol: 'sftp' | 'aspera' | 'transporter' }> = {
    spotify: {
        dpid: import.meta.env.VITE_DDEX_DPID_SPOTIFY || 'PENDING_ONBOARDING',
        name: 'Spotify AB',
        protocol: 'sftp',
    },
    apple: {
        dpid: import.meta.env.VITE_DDEX_DPID_APPLE || 'PENDING_ONBOARDING',
        name: 'Apple Inc.',
        protocol: 'transporter',
    },
    amazon: {
        dpid: import.meta.env.VITE_DDEX_DPID_AMAZON || 'PENDING_ONBOARDING',
        name: 'Amazon Digital Services',
        protocol: 'sftp',
    },
    tidal: {
        dpid: import.meta.env.VITE_DDEX_DPID_TIDAL || 'PENDING_ONBOARDING',
        name: 'TIDAL Music AS',
        protocol: 'sftp',
    },
    deezer: {
        dpid: import.meta.env.VITE_DDEX_DPID_DEEZER || 'PENDING_ONBOARDING',
        name: 'Deezer SA',
        protocol: 'sftp',
    },
    youtube_music: {
        dpid: import.meta.env.VITE_DDEX_DPID_YOUTUBE || 'PENDING_ONBOARDING',
        name: 'Google LLC (YouTube Music)',
        protocol: 'sftp',
    },
};

export class DDEXIdentity {
    /**
     * Get the sender DPID (indiiOS / New Detroit Music LLC)
     * This is the registered DPID from dpid.ddex.net
     */
    static getSenderDPID(): string {
        return DDEX_CONFIG.PARTY_ID;
    }

    /**
     * Get the sender PartyId (same as DPID for DDEX)
     */
    static getSenderPartyId(): string {
        return DDEX_CONFIG.PARTY_ID;
    }

    /**
     * Get the sender PartyName (legal entity name)
     */
    static getSenderPartyName(): string {
        return DDEX_CONFIG.PARTY_NAME;
    }

    /**
     * Get the Trading Name (DBA)
     */
    static getTradingName(): string {
        return DDEX_CONFIG.TRADING_NAME;
    }

    /**
     * Resolves a distributor key to its recipient DPID.
     *
     * @param distributorKey - DSP identifier (e.g., 'spotify', 'apple')
     * @returns The DPID for the target DSP
     * @throws Error if the DSP is not found in the registry
     */
    static getRecipientDPID(distributorKey: string): string {
        const key = distributorKey.toLowerCase().replace(/[\s-]/g, '_');
        const dsp = DSP_REGISTRY[key];

        if (!dsp) {
            throw new Error(
                `Unknown DSP: '${distributorKey}'. ` +
                `Available DSPs: ${Object.keys(DSP_REGISTRY).join(', ')}`
            );
        }

        if (dsp.dpid === 'PENDING_ONBOARDING') {
            throw new Error(
                `DPID for ${dsp.name} is pending onboarding. ` +
                `Complete the content provider application with ${dsp.name} to obtain their DPID, ` +
                `then set VITE_DDEX_DPID_${key.toUpperCase()} environment variable.`
            );
        }

        return dsp.dpid;
    }

    /**
     * Get the delivery protocol for a DSP.
     */
    static getDeliveryProtocol(distributorKey: string): 'sftp' | 'aspera' | 'transporter' {
        const key = distributorKey.toLowerCase().replace(/[\s-]/g, '_');
        return DSP_REGISTRY[key]?.protocol || 'sftp';
    }

    /**
     * Get all registered DSPs and their onboarding status.
     */
    static getDSPRegistry(): Array<{ key: string; name: string; dpid: string; ready: boolean; protocol: string }> {
        return Object.entries(DSP_REGISTRY).map(([key, dsp]) => ({
            key,
            name: dsp.name,
            dpid: dsp.dpid,
            ready: dsp.dpid !== 'PENDING_ONBOARDING',
            protocol: dsp.protocol,
        }));
    }
}

