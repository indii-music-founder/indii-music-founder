/**
 * IPFSPinataService — Item 238
 *
 * Pins release metadata and assets to IPFS when a secured backend is
 * configured. Browser-side Pinata JWT usage is disabled.
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

export class IPFSPinataService {
    isConfigured(): boolean {
        return false;
    }

    /**
     * Pin JSON metadata object to IPFS (release metadata, split sheets, etc.)
     */
    async pinJSON(metadata: ReleaseMetadataPin | Record<string, unknown>, name?: string): Promise<PinResult> {
        void metadata;
        void name;
        throw new Error('Pinata pinning is backend-only in the web renderer. Configure a secured backend gateway before pinning JSON.');
    }

    /**
     * Pin a file (Blob/File) to IPFS — used for cover art, audio masters.
     */
    async pinFile(file: File | Blob, filename: string): Promise<PinResult> {
        void file;
        void filename;
        throw new Error('Pinata file pinning is backend-only in the web renderer. Configure a secured backend gateway before pinning files.');
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
        void cid;
        throw new Error('Pinata unpinning is backend-only in the web renderer. Configure a secured backend gateway before unpinning content.');
    }

    /**
     * Check if a CID is currently pinned.
     */
    async isPinned(cid: string): Promise<boolean> {
        void cid;
        return false;
    }

}

export const ipfsPinataService = new IPFSPinataService();
