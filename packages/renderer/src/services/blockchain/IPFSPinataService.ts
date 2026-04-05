/**
 * IPFSPinataService — Item 238
 *
 * Pins release metadata and assets to IPFS via Pinata REST API.
 * No SDK dependency — uses native fetch.
 *
 * Env:
 *   VITE_PINATA_JWT   — Pinata JWT token (from pinata.cloud API keys)
 *   VITE_PINATA_GATEWAY — Optional dedicated gateway (e.g. https://myapp.mypinata.cloud)
 */

export interface PinResult {
    cid: string;         // IPFS Content Identifier
    ipfsUrl: string;     // ipfs:// URI
    gatewayUrl: string;  // HTTPS gateway URL for direct access
    size: number;        // bytes
    pinnedAt: string;    // ISO timestamp
}

export interface ReleaseMetadataPin {
    isrc: string;
    title: string;
    artist: string;
    releaseDate: string;
    upc?: string;
    coverArtCid?: string;
    audioCid?: string;
    splits?: { address: string; percentage: number; role: string }[];
}

const PINATA_API = 'https://api.pinata.cloud';
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud';

export class IPFSPinataService {
    private jwt: string;
    private gateway: string;

    constructor() {
        this.jwt = import.meta.env.VITE_PINATA_JWT || '';
        this.gateway = import.meta.env.VITE_PINATA_GATEWAY || DEFAULT_GATEWAY;
    }

    isConfigured(): boolean {
        return this.jwt.length > 0 && this.jwt !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Pin JSON metadata object to IPFS (release metadata, split sheets, etc.)
     */
    async pinJSON(metadata: ReleaseMetadataPin | Record<string, unknown>, name?: string): Promise<PinResult> {
        if (!this.isConfigured()) {
            throw new Error('Pinata JWT not configured. Set VITE_PINATA_JWT in .env');
        }

        const body = {
            pinataContent: metadata,
            pinataMetadata: { name: name || `indiiOS-${Date.now()}` },
            pinataOptions: { cidVersion: 1 },
        };

        const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.jwt}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Pinata pin JSON failed (${res.status}): ${err}`);
        }

        const data = await res.json() as { IpfsHash: string; PinSize: number; Timestamp: string };
        return this.buildResult(data.IpfsHash, data.PinSize, data.Timestamp);
    }

    /**
     * Pin a file (Blob/File) to IPFS — used for cover art, audio masters.
     */
    async pinFile(file: File | Blob, filename: string): Promise<PinResult> {
        if (!this.isConfigured()) {
            throw new Error('Pinata JWT not configured. Set VITE_PINATA_JWT in .env');
        }

        const form = new FormData();
        form.append('file', file, filename);
        form.append('pinataMetadata', JSON.stringify({ name: filename }));
        form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

        const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.jwt}` },
            body: form,
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Pinata pin file failed (${res.status}): ${err}`);
        }

        const data = await res.json() as { IpfsHash: string; PinSize: number; Timestamp: string };
        return this.buildResult(data.IpfsHash, data.PinSize, data.Timestamp);
    }

    /**
     * Pin a release — pins metadata JSON and returns the metadata CID.
     * The metadata JSON references audio and art CIDs if already pinned.
     */
    async pinRelease(metadata: ReleaseMetadataPin): Promise<PinResult> {
        return this.pinJSON(metadata, `${metadata.title} — ${metadata.artist}`);
    }

    /**
     * Unpin a CID from Pinata (removes from pinned set, GC may remove from IPFS).
     */
    async unpin(cid: string): Promise<void> {
        if (!this.isConfigured()) return;

        const res = await fetch(`${PINATA_API}/pinning/unpin/${cid}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.jwt}` },
        });

        if (!res.ok && res.status !== 404) {
            const err = await res.text();
            throw new Error(`Pinata unpin failed (${res.status}): ${err}`);
        }
    }

    /**
     * Check if a CID is currently pinned.
     */
    async isPinned(cid: string): Promise<boolean> {
        if (!this.isConfigured()) return false;

        const res = await fetch(
            `${PINATA_API}/data/pinList?hashContains=${cid}&status=pinned`,
            { headers: { Authorization: `Bearer ${this.jwt}` } }
        );

        if (!res.ok) return false;
        const data = await res.json() as { count: number };
        return data.count > 0;
    }

    private buildResult(cid: string, size: number, timestamp: string): PinResult {
        return {
            cid,
            ipfsUrl: `ipfs://${cid}`,
            gatewayUrl: `${this.gateway}/ipfs/${cid}`,
            size,
            pinnedAt: timestamp,
        };
    }
}

export const ipfsPinataService = new IPFSPinataService();
