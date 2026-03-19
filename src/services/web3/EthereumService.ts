/**
 * Item 237: Ethereum/Smart Contract Service (via Alchemy RPC)
 *
 * Provides ethers.js integration for reading blockchain state,
 * deploying contracts, and interacting with smart contracts.
 *
 * Setup: Get a free API key from https://dashboard.alchemy.com/signup
 * Env: VITE_ALCHEMY_API_KEY
 * Free tier: 30M Compute Units/month, 25 req/sec
 */

export interface ContractConfig {
    address: string;
    abi: unknown[];
    chainId: number;
}

export interface TransactionResult {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
    gasUsed?: string;
}

export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
}

const CHAIN_RPC_URLS: Record<number, string> = {
    1: 'https://eth-mainnet.g.alchemy.com/v2/',
    11155111: 'https://eth-sepolia.g.alchemy.com/v2/', // Sepolia testnet
    137: 'https://polygon-mainnet.g.alchemy.com/v2/',
    42161: 'https://arb-mainnet.g.alchemy.com/v2/',
};

export class EthereumService {
    private apiKey: string;
    private defaultChainId: number;

    constructor(chainId: number = 11155111) { // Default to Sepolia testnet
        this.apiKey = import.meta.env.VITE_ALCHEMY_API_KEY || '';
        this.defaultChainId = chainId;
    }

    /**
     * Check if the service is configured.
     */
    isConfigured(): boolean {
        return this.apiKey.length > 0 && this.apiKey !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Get the RPC URL for a given chain.
     */
    getRpcUrl(chainId?: number): string {
        const chain = chainId || this.defaultChainId;
        const baseUrl = CHAIN_RPC_URLS[chain];
        if (!baseUrl) {
            throw new Error(`Unsupported chain ID: ${chain}`);
        }
        return `${baseUrl}${this.apiKey}`;
    }

    /**
     * Make a JSON-RPC call to the Ethereum node.
     */
    async rpcCall(method: string, params: unknown[] = [], chainId?: number): Promise<unknown> {
        if (!this.isConfigured()) {
            throw new Error('Alchemy API key not configured. Set VITE_ALCHEMY_API_KEY in .env');
        }

        const response = await fetch(this.getRpcUrl(chainId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
            }),
        });

        if (!response.ok) {
            throw new Error(`RPC call failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`RPC error: ${data.error.message}`);
        }

        return data.result;
    }

    /**
     * Get the ETH balance of an address.
     */
    async getBalance(address: string, chainId?: number): Promise<string> {
        const result = await this.rpcCall('eth_getBalance', [address, 'latest'], chainId);
        const wei = BigInt(result as string);
        // Convert wei to ETH (18 decimals)
        const eth = Number(wei) / 1e18;
        return eth.toFixed(6);
    }

    /**
     * Get the current block number.
     */
    async getBlockNumber(chainId?: number): Promise<number> {
        const result = await this.rpcCall('eth_blockNumber', [], chainId);
        return parseInt(result as string, 16);
    }

    /**
     * Get transaction receipt by hash.
     */
    async getTransactionReceipt(txHash: string, chainId?: number): Promise<TransactionResult> {
        const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash], chainId) as Record<string, string> | null;

        if (!receipt) {
            return { hash: txHash, status: 'pending' };
        }

        return {
            hash: txHash,
            status: receipt.status === '0x1' ? 'confirmed' : 'failed',
            blockNumber: parseInt(receipt.blockNumber!, 16),
            gasUsed: parseInt(receipt.gasUsed!, 16).toString(),
        };
    }

    /**
     * Call a read-only contract method.
     */
    async callContract(contractAddress: string, data: string, chainId?: number): Promise<string> {
        const result = await this.rpcCall('eth_call', [
            { to: contractAddress, data },
            'latest',
        ], chainId);
        return result as string;
    }
}

export const ethereumService = new EthereumService();
