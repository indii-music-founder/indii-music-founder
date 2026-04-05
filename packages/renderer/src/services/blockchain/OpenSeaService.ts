/**
 * OpenSeaService — Item 239
 *
 * Submits NFT tokens to OpenSea after minting to create marketplace listings.
 * Uses OpenSea API v2 (no external SDK required).
 *
 * Env:
 *   VITE_OPENSEA_API_KEY — OpenSea API key (from opensea.io/account/api-keys)
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

const OPENSEA_API = 'https://api.opensea.io/api/v2';

// Chain slug map for OpenSea API
const CHAIN_SLUG: Record<NFTAsset['chain'], string> = {
    ethereum: 'ethereum',
    polygon: 'matic',
    arbitrum: 'arbitrum',
};

// OpenSea base URL for asset links
const OPENSEA_ASSET_URL: Record<NFTAsset['chain'], string> = {
    ethereum: 'https://opensea.io/assets/ethereum',
    polygon: 'https://opensea.io/assets/matic',
    arbitrum: 'https://opensea.io/assets/arbitrum',
};

export class OpenSeaService {
    private apiKey: string;

    constructor() {
        this.apiKey = import.meta.env.VITE_OPENSEA_API_KEY || '';
    }

    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Item 239 — Trigger OpenSea to re-index token metadata after mint.
     * This makes the token immediately visible on the OpenSea marketplace.
     */
    async refreshMetadata(asset: NFTAsset): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('OpenSea API key not configured. Set VITE_OPENSEA_API_KEY in .env');
        }

        const chain = CHAIN_SLUG[asset.chain];
        const url = `${OPENSEA_API}/chain/${chain}/contract/${asset.contractAddress}/nfts/${asset.tokenId}/refresh`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'x-api-key': this.apiKey,
            },
        });

        // 200 or 204 = success; 404 = not indexed yet (retry in 60s)
        if (!res.ok && res.status !== 404) {
            const err = await res.text();
            throw new Error(`OpenSea metadata refresh failed (${res.status}): ${err}`);
        }
    }

    /**
     * Get token info from OpenSea (name, image, owner, etc.).
     */
    async getNFT(asset: NFTAsset): Promise<Record<string, unknown>> {
        if (!this.isConfigured()) {
            throw new Error('OpenSea API key not configured');
        }

        const chain = CHAIN_SLUG[asset.chain];
        const url = `${OPENSEA_API}/chain/${chain}/contract/${asset.contractAddress}/nfts/${asset.tokenId}`;

        const res = await fetch(url, {
            headers: {
                accept: 'application/json',
                'x-api-key': this.apiKey,
            },
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenSea getNFT failed (${res.status}): ${err}`);
        }

        return res.json() as Promise<Record<string, unknown>>;
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
        if (!this.isConfigured()) {
            throw new Error('OpenSea API key not configured');
        }

        // Build listing via OpenSea Seaport API — they generate the order for you to sign
        const chain = CHAIN_SLUG[asset.chain];
        const startTime = Math.floor(Date.now() / 1000).toString();
        const endTime = (Math.floor(Date.now() / 1000) + durationDays * 86400).toString();

        // Step 1: Get the listing order from OpenSea (they prepare the Seaport struct)
        const buildRes = await fetch(`${OPENSEA_API}/listings`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'x-api-key': this.apiKey,
            },
            body: JSON.stringify({
                chain,
                offerer: sellerAddress,
                offer: [{ itemType: 3, token: asset.contractAddress, identifierOrCriteria: asset.tokenId, startAmount: '1', endAmount: '1' }],
                consideration: [],
                startTime,
                endTime,
                price: { amount: { decimal: priceEth }, currency: 'ETH' },
            }),
        });

        if (!buildRes.ok) {
            const err = await buildRes.text();
            throw new Error(`OpenSea listing build failed (${buildRes.status}): ${err}`);
        }

        const order = await buildRes.json() as { order: { parameters: unknown } };

        // Step 2: Sign with wallet (requires window.ethereum)
        if (typeof window === 'undefined' || !window.ethereum) {
            throw new Error('No wallet connected. Connect MetaMask or WalletConnect to create listings.');
        }

        const signature = await window.ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [sellerAddress, JSON.stringify(order.order)],
        }) as string;

        // Step 3: Submit signed order to OpenSea
        const submitRes = await fetch(`${OPENSEA_API}/orders/${chain}/seaport/listings`, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'x-api-key': this.apiKey,
            },
            body: JSON.stringify({ ...order, signature }),
        });

        if (!submitRes.ok) {
            const err = await submitRes.text();
            throw new Error(`OpenSea listing submit failed (${submitRes.status}): ${err}`);
        }

        const result = await submitRes.json() as { order: { order_hash: string } };

        return {
            listingId: result.order.order_hash,
            tokenUrl: `${OPENSEA_ASSET_URL[asset.chain]}/${asset.contractAddress}/${asset.tokenId}`,
            price: priceEth,
            currency: 'ETH',
            status: 'active',
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Build a direct OpenSea asset URL (no API call needed).
     */
    getAssetUrl(asset: NFTAsset): string {
        return `${OPENSEA_ASSET_URL[asset.chain]}/${asset.contractAddress}/${asset.tokenId}`;
    }
}

export const openSeaService = new OpenSeaService();
