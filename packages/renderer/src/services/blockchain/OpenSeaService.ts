/**
 * OpenSeaService — Item 239
 *
 * Builds OpenSea asset URLs and delegates provider-key operations to backend
 * services. Browser-side OpenSea API keys are disabled.
 *
 * Flow:
 *   1. After mint, call `refreshMetadata()` to make OpenSea index the token
 *   2. Optionally call `createListing()` to set a fixed-price sale
 */

export interface NFTAsset {
    contractAddress: string;   // ERC-1155/721 contract address
    tokenId: string;           // Token ID (decimal string)
    chain: 'ethereum' | 'polygon' | 'arbitrum';
}

export interface OpenSeaListing {
    listingId: string;
    tokenUrl: string;         // Direct OpenSea asset URL
    price?: string;           // Optional price in ETH (e.g. "0.05")
    currency?: string;        // ETH, MATIC, etc.
    status: 'active' | 'pending' | 'cancelled';
    createdAt: string;
}

export interface OpenSeaOrderPayload {
    parameters: {
        offerer: string;
        offer: { itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string }[];
        consideration: { itemType: number; token: string; identifierOrCriteria: string; startAmount: string; endAmount: string; recipient: string }[];
        orderType: number;
        startTime: string;
        endTime: string;
        zone: string;
        zoneHash: string;
        salt: string;
        conduitKey: string;
        totalOriginalConsiderationItems: number;
    };
    signature: string;
}

// OpenSea base URL for asset links
const OPENSEA_ASSET_URL: Record<NFTAsset['chain'], string> = {
    ethereum: 'https://opensea.io/assets/ethereum',
    polygon: 'https://opensea.io/assets/matic',
    arbitrum: 'https://opensea.io/assets/arbitrum',
};

export class OpenSeaService {
    isConfigured(): boolean {
        return false;
    }

    /**
     * Item 239 — Trigger OpenSea to re-index token metadata after mint.
     * This makes the token immediately visible on the OpenSea marketplace.
     */
    async refreshMetadata(asset: NFTAsset): Promise<void> {
        void asset;
        throw new Error('OpenSea metadata refresh is backend-only in the web renderer.');
    }

    /**
     * Get token info from OpenSea (name, image, owner, etc.).
     */
    async getNFT(asset: NFTAsset): Promise<Record<string, unknown>> {
        void asset;
        throw new Error('OpenSea marketplace access is backend-only in the web renderer.');
    }

    /**
     * Create a fixed-price listing on OpenSea via Seaport protocol.
     * Requires a signed Seaport order from the seller's wallet.
     *
     * Workflow:
     *   1. Build order parameters from the SDK (or raw)
     *   2. Sign with wallet (window.ethereum)
     *   3. POST signed order to OpenSea
     */
    async createListing(
        asset: NFTAsset,
        sellerAddress: string,
        priceEth: string,
        durationDays: number = 7
    ): Promise<OpenSeaListing> {
        void asset;
        void sellerAddress;
        void priceEth;
        void durationDays;
        throw new Error('OpenSea listing creation is backend-only in the web renderer.');
    }

    /**
     * Build a direct OpenSea asset URL (no API call needed).
     */
    getAssetUrl(asset: NFTAsset): string {
        return `${OPENSEA_ASSET_URL[asset.chain]}/${asset.contractAddress}/${asset.tokenId}`;
    }
}

export const openSeaService = new OpenSeaService();
