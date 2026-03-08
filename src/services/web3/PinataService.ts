/**
 * Item 238: Pinata IPFS Pinning Service
 *
 * Provides IPFS content pinning for decentralized storage of
 * album art, metadata JSON, and music NFT assets.
 *
 * Setup: Get a free API key from https://app.pinata.cloud/register
 * Env: VITE_PINATA_API_KEY, VITE_PINATA_SECRET
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

const PINATA_API = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export class PinataService {
    private apiKey: string;
    private secretKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_PINATA_API_KEY || '';
        this.secretKey = import.meta.env.VITE_PINATA_SECRET || '';
    }

    /**
     * Check if Pinata is configured.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Get authorization headers for Pinata API.
     */
    private getHeaders(): Record<string, string> {
        return {
            'pinata_api_key': this.apiKey,
            'pinata_secret_api_key': this.secretKey,
        };
    }

    /**
     * Pin a JSON object to IPFS (for NFT metadata).
     */
    async pinJSON(data: unknown, options?: PinataOptions): Promise<PinResult> {
        if (!this.isConfigured()) {
            throw new Error('Pinata not configured. Set VITE_PINATA_API_KEY and VITE_PINATA_SECRET in .env');
        }

        const body = {
            pinataContent: data,
            pinataMetadata: {
                name: options?.name || `indiiOS-${Date.now()}`,
                keyvalues: options?.keyValues || {},
            },
        };

        const response = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata pin failed: ${response.status} — ${error}`);
        }

        const result = await response.json();
        return {
            ipfsHash: result.IpfsHash,
            pinSize: result.PinSize,
            timestamp: result.Timestamp,
            gatewayUrl: `${PINATA_GATEWAY}/${result.IpfsHash}`,
        };
    }

    /**
     * Pin a file (blob) to IPFS (for album art, audio previews).
     */
    async pinFile(file: File | Blob, options?: PinataOptions): Promise<PinResult> {
        if (!this.isConfigured()) {
            throw new Error('Pinata not configured');
        }

        const formData = new FormData();
        formData.append('file', file);

        if (options?.name) {
            formData.append('pinataMetadata', JSON.stringify({
                name: options.name,
                keyvalues: options?.keyValues || {},
            }));
        }

        const response = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pinata file pin failed: ${response.status} — ${error}`);
        }

        const result = await response.json();
        return {
            ipfsHash: result.IpfsHash,
            pinSize: result.PinSize,
            timestamp: result.Timestamp,
            gatewayUrl: `${PINATA_GATEWAY}/${result.IpfsHash}`,
        };
    }

    /**
     * List all pinned items.
     */
    async listPins(limit: number = 10): Promise<PinnedItem[]> {
        if (!this.isConfigured()) {
            throw new Error('Pinata not configured');
        }

        const response = await fetch(
            `${PINATA_API}/data/pinList?status=pinned&pageLimit=${limit}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`Failed to list pins: ${response.status}`);
        }

        const data = await response.json();
        return (data.rows || []).map((pin: Record<string, unknown>) => ({
            id: pin.id as string,
            ipfsHash: pin.ipfs_pin_hash as string,
            size: pin.size as number,
            name: (pin.metadata as Record<string, unknown>)?.name as string || 'Unnamed',
            dateCreated: pin.date_pinned as string,
        }));
    }

    /**
     * Unpin content from IPFS.
     */
    async unpin(ipfsHash: string): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('Pinata not configured');
        }

        const response = await fetch(`${PINATA_API}/pinning/unpin/${ipfsHash}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to unpin ${ipfsHash}: ${response.status}`);
        }
    }

    /**
     * Get the public gateway URL for an IPFS hash.
     */
    getGatewayUrl(ipfsHash: string): string {
        return `${PINATA_GATEWAY}/${ipfsHash}`;
    }
}

export const pinataService = new PinataService();
