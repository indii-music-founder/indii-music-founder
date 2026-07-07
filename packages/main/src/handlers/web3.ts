import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';
import log from 'electron-log';
import * as crypto from 'crypto';

// Types for transaction input
export interface TransactionPayload {
    from?: string;
    to: string;
    value?: string; // hex or decimal string
    data?: string;  // hex data payload
    gasLimit?: string | number;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

export interface Web3ProviderMetadata {
    rpcUrl: string | null;
    isSimulated: boolean;
    chainId: string;
    networkName: string;
}

class EthereumNetworkWrapper {
    private rpcUrl: string | null = null;
    private chainId = '0x1'; // Default: Ethereum Mainnet (1)
    private simulatedBlockNumber = 18000000;

    constructor() {
        // Resolve configuration from environment
        this.rpcUrl = process.env.ETH_RPC_URL || process.env.VITE_ETH_RPC_URL || null;
        log.info(`[Web3] Initializing Ethereum Network Wrapper. RPC Endpoint: ${this.rpcUrl || 'SIMULATED'}`);
    }

    /**
     * Set/update the RPC URL dynamically
     */
    public setRpcUrl(url: string | null) {
        this.rpcUrl = url;
        log.info(`[Web3] Ethereum RPC URL updated to: ${url || 'SIMULATED'}`);
    }

    /**
     * Get details of the active provider
     */
    public async getProviderMetadata(): Promise<Web3ProviderMetadata> {
        if (!this.rpcUrl) {
            return {
                rpcUrl: null,
                isSimulated: true,
                chainId: '0x539', // 1337 (Local Development Network)
                networkName: 'Simulated Local Network (Development)'
            };
        }

        try {
            const chainIdHex = await this.rpcCall<string>('eth_chainId', []);
            const networkName = this.getNetworkNameByChainId(chainIdHex);
            return {
                rpcUrl: this.rpcUrl,
                isSimulated: false,
                chainId: chainIdHex,
                networkName
            };
        } catch (err: any) {
            log.warn(`[Web3] Failed to query RPC network. Falling back to simulated metadata: ${err?.message}`);
            return {
                rpcUrl: this.rpcUrl,
                isSimulated: true,
                chainId: '0x1',
                networkName: 'Ethereum Mainnet (RPC Error Fallback)'
            };
        }
    }

    /**
     * Executes transaction, calling RPC endpoint if configured, otherwise falls back to a realistic simulation
     */
    public async executeTransaction(tx: TransactionPayload) {
        if (!tx.to) {
            throw new Error('Transaction requires a target address ("to").');
        }

        // Validate hex format if data is provided
        if (tx.data && !/^0x[0-9a-fA-F]*$/.test(tx.data)) {
            throw new Error('Invalid data payload: must be hex string starting with 0x.');
        }

        // Increment block number for simulation tracking
        this.simulatedBlockNumber += Math.floor(Math.random() * 3) + 1;

        if (this.rpcUrl) {
            try {
                log.info(`[Web3] Attempting RPC transaction submission to ${this.rpcUrl}`);
                
                // Estimate gas first for real remote endpoint
                const gasEstimate = await this.rpcCall<string>('eth_estimateGas', [
                    {
                        from: tx.from,
                        to: tx.to,
                        value: tx.value,
                        data: tx.data
                    }
                ]);

                // Query current gas price
                const gasPrice = await this.rpcCall<string>('eth_gasPrice', []);

                // Send the transaction (if local unlocked accounts are configured, e.g. Anvil/Hardhat)
                const txHash = await this.rpcCall<string>('eth_sendTransaction', [
                    {
                        from: tx.from,
                        to: tx.to,
                        value: tx.value,
                        data: tx.data,
                        gas: gasEstimate,
                        gasPrice
                    }
                ]);

                log.info(`[Web3] Transaction successfully broadcasted. TxHash: ${txHash}`);

                // Wait for receipt or get status
                const blockNumber = await this.rpcCall<string>('eth_blockNumber', []).catch(() => '0x0');
                
                return {
                    success: true,
                    txHash,
                    status: 'submitted',
                    isSimulated: false,
                    blockNumber: parseInt(blockNumber, 16),
                    gasUsed: parseInt(gasEstimate, 16),
                    rpcUrl: this.rpcUrl
                };
            } catch (err: any) {
                log.warn(`[Web3] RPC execution failed: ${err.message}. Routing to simulated provider stub.`);
            }
        }

        // Simulated Provider Stub
        return this.simulateTransactionExecution(tx);
    }

    /**
     * Simulation stub for when no RPC provider is available.
     * We cannot fabricate transaction data or gas estimates.
     */
    private simulateTransactionExecution(tx: TransactionPayload) {
        throw new Error('Simulation unavailable: No active RPC provider configured.');
    }

    /**
     * Get balance wrapper (calls remote RPC or simulates)
     */
    public async getBalance(address: string): Promise<{ success: boolean; balance: string; unit: string; isSimulated: boolean }> {
        if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
            throw new Error('Invalid Ethereum address format.');
        }

        if (this.rpcUrl) {
            try {
                const balanceHex = await this.rpcCall<string>('eth_getBalance', [address, 'latest']);
                return {
                    success: true,
                    balance: balanceHex,
                    unit: 'wei',
                    isSimulated: false
                };
            } catch (err: any) {
                log.warn(`[Web3] Balance fetch failed: ${err.message}. Falling back to simulated balance.`);
            }
        }

        // Return a mock balance (e.g. 100 ETH for local testing)
        return {
            success: true,
            balance: '0x56bc75e2d63100000', // 100 ETH in wei
            unit: 'wei',
            isSimulated: true
        };
    }

    /**
     * Helper to make raw JSON-RPC HTTP calls
     */
    private async rpcCall<T>(method: string, params: any[]): Promise<T> {
        if (!this.rpcUrl) {
            throw new Error('No RPC provider configured.');
        }

        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        });

        const res = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });

        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
        }

        const json = await res.json() as any;
        if (json.error) {
            throw new Error(`JSON-RPC Error: ${json.error.message} (Code: ${json.error.code})`);
        }

        return json.result as T;
    }

    private getNetworkNameByChainId(chainIdHex: string): string {
        const id = parseInt(chainIdHex, 16);
        switch (id) {
            case 1: return 'Ethereum Mainnet';
            case 11155111: return 'Sepolia Testnet';
            case 17000: return 'Holesky Testnet';
            case 137: return 'Polygon Mainnet';
            case 80002: return 'Polygon Amoy Testnet';
            case 10: return 'Optimism Mainnet';
            case 42161: return 'Arbitrum One';
            case 1337:
            case 31337: return 'Hardhat / Anvil Localhost';
            default: return `Chain ID ${id}`;
        }
    }
}

// Singleton instances
export const ethereumNetworkWrapper = new EthereumNetworkWrapper();

export function registerWeb3Handlers() {
    // Execute a transaction
    ipcMain.handle('web3:execute-transaction', async (event, data: TransactionPayload) => {
        validateSender(event);
        try {
            return await ethereumNetworkWrapper.executeTransaction(data);
        } catch (err: any) {
            log.error('[Web3] Error executing transaction:', err);
            return { success: false, error: err?.message || String(err) };
        }
    });

    // Get metadata about connection provider
    ipcMain.handle('web3:get-provider-metadata', async (event) => {
        validateSender(event);
        try {
            return await ethereumNetworkWrapper.getProviderMetadata();
        } catch (err: any) {
            log.error('[Web3] Error getting provider metadata:', err);
            return { success: false, error: err?.message || String(err) };
        }
    });

    // Update connection provider RPC URL
    ipcMain.handle('web3:set-rpc-url', async (event, rpcUrl: string | null) => {
        validateSender(event);
        try {
            ethereumNetworkWrapper.setRpcUrl(rpcUrl);
            return { success: true };
        } catch (err: any) {
            log.error('[Web3] Error setting RPC URL:', err);
            return { success: false, error: err?.message || String(err) };
        }
    });

    // Query balance of an address
    ipcMain.handle('web3:get-balance', async (event, address: string) => {
        validateSender(event);
        try {
            return await ethereumNetworkWrapper.getBalance(address);
        } catch (err: any) {
            log.error('[Web3] Error querying balance:', err);
            return { success: false, error: err?.message || String(err) };
        }
    });
}
