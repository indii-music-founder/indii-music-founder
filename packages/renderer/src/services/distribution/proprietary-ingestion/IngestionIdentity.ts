import { INGESTION_CONFIG } from '@/core/config/ingestion';

/**
 * Ingestion Identity Service
 * Manages SystemIdentitys and Party IDs for the indii distribution pipeline.
 *
 * SystemIdentitys (Ingestion Party IDs) are registered at https://systemIdentifier.ddex.net/
 * Each DSP has a unique SystemIdentity that must be used as the MessageRecipient.
 *
 * Production SystemIdentitys are obtained during the onboarding process with each DSP.
 * The placeholder SystemIdentitys below should be replaced with real values once onboarded.
 */

/** Known DSP recipient registry.
 *
 * These SystemIdentitys are used as MessageRecipient in Ingestion IngestionNotification messages.
 * Real SystemIdentitys are obtained during the content provider onboarding
 * process with each DSP. Update these values when onboarding completes.
 *
 * Set via environment variables for deployment flexibility:
 *   VITE_Ingestion_SystemIdentity_SPOTIFY, VITE_Ingestion_SystemIdentity_APPLE, etc.
 */
const INGESTION_REGISTRY: Record<string, { systemIdentifier: string; entityName: string; protocol: 'sftp' | 'aspera' | 'transporter' }> = {
    spotify: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_SPOTIFY || 'PENDING_ONBOARDING',
        entityName: 'Spotify AB',
        protocol: 'sftp',
    },
    apple: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_APPLE || 'PENDING_ONBOARDING',
        entityName: 'Apple Inc.',
        protocol: 'transporter',
    },
    amazon: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_AMAZON || 'PENDING_ONBOARDING',
        entityName: 'Amazon Digital Services',
        protocol: 'sftp',
    },
    tidal: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_TIDAL || 'PENDING_ONBOARDING',
        entityName: 'TIDAL Music AS',
        protocol: 'sftp',
    },
    deezer: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_DEEZER || 'PENDING_ONBOARDING',
        entityName: 'Deezer SA',
        protocol: 'sftp',
    },
    youtube_music: {
        systemIdentifier: import.meta.env.VITE_Ingestion_SystemIdentity_YOUTUBE || 'PENDING_ONBOARDING',
        entityName: 'Google LLC (YouTube Music)',
        protocol: 'sftp',
    },
};

export class IngestionIdentity {
    /**
     * Get the sender SystemIdentity (indii / New Detroit Music LLC)
     * This is the registered SystemIdentity from systemIdentifier.ddex.net
     */
    static getSenderSystemIdentity(): string {
        return INGESTION_CONFIG.SYSTEM_IDENTIFIER;
    }

    /**
     * Get the sender SystemIdentifier (same as SystemIdentity for Ingestion)
     */
    static getSenderSystemIdentifier(): string {
        return INGESTION_CONFIG.SYSTEM_IDENTIFIER;
    }

    /**
     * Get the sender EntityName (legal entity name)
     */
    static getSenderEntityName(): string {
        return INGESTION_CONFIG.ENTITY_NAME;
    }

    /**
     * Get the Trading Name (DBA)
     */
    static getTradingName(): string {
        return INGESTION_CONFIG.TRADING_NAME;
    }

    /**
     * Resolves a distributor key to its recipient SystemIdentity.
     *
     * @param distributorKey - DSP identifier (e.g., 'spotify', 'apple')
     * @returns The SystemIdentity for the target DSP
     * @throws Error if the DSP is not found in the registry
     */
    static getRecipientSystemIdentity(distributorKey: string): string {
        const key = distributorKey.toLowerCase().replace(/[\s-]/g, '_');
        const dsp = INGESTION_REGISTRY[key];

        if (!dsp) {
            throw new Error(
                `Unknown DSP: '${distributorKey}'. ` +
                `Available DSPs: ${Object.keys(INGESTION_REGISTRY).join(', ')}`
            );
        }

        if (dsp.systemIdentifier === 'PENDING_ONBOARDING') {
            throw new Error(
                `SystemIdentity for ${dsp.entityName} is pending onboarding. ` +
                `Complete the content provider application with ${dsp.entityName} to obtain their SystemIdentity, ` +
                `then set VITE_Ingestion_SystemIdentity_${key.toUpperCase()} environment variable.`
            );
        }

        return dsp.systemIdentifier;
    }

    /**
     * Get the delivery protocol for a DSP.
     */
    static getDeliveryProtocol(distributorKey: string): 'sftp' | 'aspera' | 'transporter' {
        const key = distributorKey.toLowerCase().replace(/[\s-]/g, '_');
        return INGESTION_REGISTRY[key]?.protocol || 'sftp';
    }

    /**
     * Get all registered DSPs and their onboarding status.
     */
    static getDSPRegistry(): Array<{ key: string; entityName: string; systemIdentifier: string; ready: boolean; protocol: string }> {
        return Object.entries(INGESTION_REGISTRY).map(([key, dsp]) => ({
            key,
            entityName: dsp.entityName,
            systemIdentifier: dsp.systemIdentifier,
            ready: dsp.systemIdentifier !== 'PENDING_ONBOARDING',
            protocol: dsp.protocol,
        }));
    }
}

