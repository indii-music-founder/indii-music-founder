import { DDEX_CONFIG } from '@/core/config/ddex';

/**
 * DDEX Identity Service
 * Manages DPIDs and Party IDs for the indiiOS distribution pipeline.
 */
export class DDEXIdentity {
    /**
     * Get the sender DPID (indiiOS)
     */
    static getSenderDPID(): string {
        return DDEX_CONFIG.DPID || 'PADPIDA0000000000'; // Placeholder if not set
    }

    /**
     * Get the sender PartyId
     */
    static getSenderPartyId(): string {
        return DDEX_CONFIG.PARTY_ID || 'indiiOS-Gateway-Alpha';
    }

    /**
     * Get the sender PartyName
     */
    static getSenderPartyName(): string {
        return DDEX_CONFIG.PARTY_NAME || 'indiiOS Global';
    }

    /**
     * Resolves a distributor key to its recipient DPID
     */
    static getRecipientDPID(distributorKey: string): string {
        // In a real scenario, this pulls from a distributor registry or env
        const recipients: Record<string, string> = {
            'spotify': 'PADPIDA2021021001', // Example
            'apple': 'PADPIDA2021021002',
            'generic': 'PADPIDA0000000001'
        };
        return recipients[distributorKey] || recipients.generic;
    }
}
