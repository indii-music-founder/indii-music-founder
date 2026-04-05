/**
 * Item 239: OpenSea Marketplace Service
 *
 * Provides NFT marketplace integration for listing, pricing,
 * and querying music NFTs on OpenSea.
 *
 * Setup: Get a free API key from https://docs.opensea.io/reference/api-keys
 * Env: VITE_OPENSEA_API_KEY
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

const OPENSEA_API_V2 = 'https://api.opensea.io/api/v2';

export class OpenSeaService {
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_OPENSEA_API_KEY || '';
    }

    /**
     * Check if OpenSea API is configured.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Get authorization headers.
     */
    private getHeaders(): Record<string, string> {
        return {
            'X-API-KEY': this.apiKey,
            'Accept': 'application/json',
        };
    }

    /**
     * Get NFTs owned by an address.
     */
    async getNFTsByOwner(ownerAddress: string, chain: string = 'ethereum', limit: number = 20): Promise<NFTListing[]> {
        if (!this.isConfigured()) {
            throw new Error('OpenSea API not configured. Set VITE_OPENSEA_API_KEY in .env');
        }

        const response = await fetch(
            `${OPENSEA_API_V2}/chain/${chain}/account/${ownerAddress}/nfts?limit=${limit}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            throw new Error(`OpenSea API error: ${response.status}`);
        }

        const data = await response.json();
        return (data.nfts || []).map((nft: Record<string, unknown>) => ({
            tokenId: nft.identifier as string,
            contractAddress: nft.contract as string,
            name: nft.name as string || 'Untitled',
            description: nft.description as string || '',
            imageUrl: nft.image_url as string || '',
            animationUrl: nft.animation_url as string || undefined,
            ownerAddress,
            chain,
        }));
    }

    /**
     * Get details of a single NFT.
     */
    async getNFT(contractAddress: string, tokenId: string, chain: string = 'ethereum'): Promise<NFTListing | null> {
        if (!this.isConfigured()) {
            throw new Error('OpenSea API not configured');
        }

        const response = await fetch(
            `${OPENSEA_API_V2}/chain/${chain}/contract/${contractAddress}/nfts/${tokenId}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`OpenSea API error: ${response.status}`);
        }

        const data = await response.json();
        const nft = data.nft;
        return {
            tokenId: nft.identifier,
            contractAddress: nft.contract,
            name: nft.name || 'Untitled',
            description: nft.description || '',
            imageUrl: nft.image_url || '',
            animationUrl: nft.animation_url || undefined,
            ownerAddress: nft.owners?.[0]?.address || '',
            chain,
        };
    }

    /**
     * Get collection info by slug.
     */
    async getCollection(slug: string): Promise<NFTCollection | null> {
        if (!this.isConfigured()) {
            throw new Error('OpenSea API not configured');
        }

        const response = await fetch(
            `${OPENSEA_API_V2}/collections/${slug}`,
            { headers: this.getHeaders() }
        );

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`OpenSea API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            slug: data.collection,
            name: data.name,
            description: data.description || '',
            imageUrl: data.image_url || '',
            totalSupply: data.total_supply || 0,
        };
    }
}

export const openSeaService = new OpenSeaService();
