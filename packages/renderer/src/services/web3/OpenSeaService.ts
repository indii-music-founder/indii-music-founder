/**
 * Item 239: OpenSea Marketplace Service
 *
 * Provides NFT marketplace integration for listing, pricing,
 * and querying music NFTs on OpenSea.
 *
 * Browser-side OpenSea API keys are disabled. Use a secured backend gateway
 * for marketplace operations.
 */

export interface NFTListing {
    tokenId: string;
    contractAddress: string;
    name: string;
    description: string;
    imageUrl: string;
    animationUrl?: string;
    currentPrice?: string;
    currency?: string;
    ownerAddress: string;
    chain: string;
}

export interface NFTCollection {
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    totalSupply: number;
    floorPrice?: string;
}

export interface ListingParams {
    contractAddress: string;
    tokenId: string;
    startAmount: string;
    expirationTime?: number;
}

export class OpenSeaService {
    /**
     * Check if OpenSea API is configured.
     */
    isConfigured(): boolean {
        return false;
    }

    /**
     * Get NFTs owned by an address.
     */
    async getNFTsByOwner(ownerAddress: string, chain: string = 'ethereum', limit: number = 20): Promise<NFTListing[]> {
        void ownerAddress;
        void chain;
        void limit;
        throw new Error('OpenSea marketplace access is backend-only in the web renderer.');
    }

    /**
     * Get details of a single NFT.
     */
    async getNFT(contractAddress: string, tokenId: string, chain: string = 'ethereum'): Promise<NFTListing | null> {
        void contractAddress;
        void tokenId;
        void chain;
        throw new Error('OpenSea marketplace access is backend-only in the web renderer.');
    }

    /**
     * Get collection info by slug.
     */
    async getCollection(slug: string): Promise<NFTCollection | null> {
        void slug;
        throw new Error('OpenSea marketplace access is backend-only in the web renderer.');
    }
}

export const openSeaService = new OpenSeaService();
