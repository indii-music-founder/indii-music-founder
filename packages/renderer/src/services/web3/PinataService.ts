/**
 * Item 238: Pinata IPFS Pinning Service
 *
 * Provides IPFS content pinning for decentralized storage of
 * album art, metadata JSON, and music NFT assets.
 *
 * Browser-side Pinata credentials are disabled. Use Electron main-process IPC
 * or a secured Firebase gateway for IPFS pinning.
 * Free tier: 1GB storage, 500 pinned files
 */

export interface PinResult {
    ipfsHash: string;
    pinSize: number;
    timestamp: string;
    gatewayUrl: string;
}

export interface PinnedItem {
    id: string;
    ipfsHash: string;
    size: number;
    name: string;
    dateCreated: string;
    mimeType?: string;
}

export interface PinataOptions {
    name?: string;
    keyValues?: Record<string, string>;
}

const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export class PinataService {
    /**
     * Check if Pinata is configured.
     */
    isConfigured(): boolean {
        return false;
    }

    /**
     * Pin a JSON object to IPFS (for NFT metadata).
     */
    async pinJSON(data: unknown, options?: PinataOptions): Promise<PinResult> {
        void data;
        void options;
        throw new Error('Pinata pinning is backend-only in the web renderer. Configure a secured backend gateway before pinning JSON.');
    }

    /**
     * Pin a file (blob) to IPFS (for album art, audio previews).
     */
    async pinFile(file: File | Blob, options?: PinataOptions): Promise<PinResult> {
        void file;
        void options;
        throw new Error('Pinata file pinning is backend-only in the web renderer. Configure a secured backend gateway before pinning files.');
    }

    /**
     * List all pinned items.
     */
    async listPins(limit: number = 10): Promise<PinnedItem[]> {
        void limit;
        throw new Error('Pinata pin listing is backend-only in the web renderer. Configure a secured backend gateway before listing pins.');
    }

    /**
     * Unpin content from IPFS.
     */
    async unpin(ipfsHash: string): Promise<void> {
        void ipfsHash;
        throw new Error('Pinata unpinning is backend-only in the web renderer. Configure a secured backend gateway before unpinning content.');
    }

    /**
     * Get the public gateway URL for an IPFS hash.
     */
    getGatewayUrl(ipfsHash: string): string {
        return `${PINATA_GATEWAY}/${ipfsHash}`;
    }
}

export const pinataService = new PinataService();
