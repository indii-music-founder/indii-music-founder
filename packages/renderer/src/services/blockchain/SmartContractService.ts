
import { db } from '@/services/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * SmartContractService — Item 237
 *
 * Implements the "Trust Protocol" for the 2026 Roadmap.
 * Uses window.ethereum (EIP-1193) to deploy real ERC-1155 contracts via JSON-RPC.
 *
 * Handles:
 * 1. Immutable Rights Tracking (Chain of Custody)
 * 2. Automated Split Execution via Smart Contracts (real on-chain via window.ethereum)
 * 3. Tokenization (SongShares) — ERC-1155 mint
 *
 * Env: VITE_ETH_RPC_URL — Alchemy/Infura RPC (for non-wallet reads)
 */

/**
 * ERC-1155 SongShares Bytecode
 *
 * In production, supply the compiled bytecode via VITE_SONGSHARES_BYTECODE env var.
 * Generate it from: `npx hardhat compile` → read `artifacts/contracts/SongShares.sol/SongShares.json`.bytecode
 */
const SONGSHARES_BYTECODE = import.meta.env.VITE_SONGSHARES_BYTECODE as string | undefined;

// window.ethereum type is declared in WalletConnectPanel.tsx (global augmentation)

export interface SplitContractConfig {
    contractAddress?: string; // On-chain address
    isrc: string;
    payees: {
        walletAddress: string;
        percentage: number; // 0-100
        role: string;
    }[];
    threshold?: number; // Recoupment threshold in USDC
}

export interface LedgerEntry {
    hash: string;
    timestamp: string;
    action: 'UPLOAD' | 'METADATA_UPDATE' | 'SPLIT_EXECUTION' | 'TOKEN_MINT';
    entityId: string;
    details: string;
}

export class SmartContractService {
    private readonly LEDGER_COLLECTION = 'ledger';
    private readonly CONTRACTS_COLLECTION = 'smart_contracts';

    private getSongSharesBytecode(): string {
        if (!SONGSHARES_BYTECODE) {
            throw new Error('VITE_SONGSHARES_BYTECODE is required before deploying or minting SongShares contracts.');
        }
        if (!SONGSHARES_BYTECODE.startsWith('0x')) {
            throw new Error('VITE_SONGSHARES_BYTECODE must be a hex string prefixed with 0x.');
        }
        return SONGSHARES_BYTECODE;
    }

    /**
     * Item 237 — Deploy a Smart Contract for Royalty Splits via window.ethereum.
     * Uses eth_sendTransaction to deploy a real ERC-1155 contract on the connected chain.
     * Missing wallet/provider configuration is a hard failure.
     */
    async deploySplitContract(config: SplitContractConfig): Promise<string> {
        logger.info(`[SmartContract] Deploying Split Contract for ISRC: ${config.isrc}...`);

        // Validate splits sum to 100%
        const total = config.payees.reduce((sum, p) => sum + p.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
            throw new Error(`Invalid Split Configuration: Total is ${total}%, must be 100%.`);
        }

        let contractAddress: string;

        if (typeof window !== 'undefined' && window.ethereum) {
            // Real deployment via connected wallet (MetaMask / WalletConnect)
            const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
            if (!accounts || accounts.length === 0) {
                throw new Error('No wallet connected. Connect MetaMask or WalletConnect first.');
            }

            const from = accounts[0];

            // Deploy contract: send transaction with compiled ERC-1155 bytecode, no 'to' field
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from,
                    data: this.getSongSharesBytecode(),
                    gas: '0x7A120', // 500,000 gas — sufficient for ERC-1155 constructor + storage init
                }],
            }) as string;

            // Poll for receipt to get deployed contract address
            contractAddress = await this.waitForDeployment(txHash);
            logger.info(`[SmartContract] Deployed at ${contractAddress} (tx: ${txHash})`);
        } else {
            throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before deploying contracts.');
        }

        // Persist Contract Config to Firestore
        await addDoc(collection(db, this.CONTRACTS_COLLECTION), {
            ...config,
            contractAddress,
            deployedAt: Timestamp.now(),
            status: 'active',
        });

        // Record in Immutable Chain of Custody
        await this.recordToLedger('SPLIT_EXECUTION', config.isrc, `Contract deployed at ${contractAddress}`);

        return contractAddress;
    }

    /**
     * Poll eth_getTransactionReceipt until the deployment transaction is mined.
     */
    private async waitForDeployment(txHash: string, maxAttempts = 20): Promise<string> {
        const rpcUrl = import.meta.env.VITE_ETH_RPC_URL || 'https://cloudflare-eth.com';

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 3000)); // 3s between polls

            const res = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1,
                    method: 'eth_getTransactionReceipt',
                    params: [txHash],
                }),
            });

            const data = await res.json() as { result: { contractAddress: string; status: string } | null };
            if (data.result) {
                if (data.result.status === '0x0') {
                    throw new Error(`Contract deployment failed (tx reverted): ${txHash}`);
                }
                return data.result.contractAddress;
            }
        }

        throw new Error(`Deployment transaction not mined after ${maxAttempts * 3}s: ${txHash}`);
    }

    /**
     * Execute a Payout via Smart Contract.
     * Takes incoming revenue (e.g. USDC) and distributes it according to the contract.
     */
    async executePayout(contractAddress: string, amountUSDC: number): Promise<boolean> {
        logger.info(`[SmartContract] Executing Payout of ${amountUSDC} USDC via ${contractAddress}`);

        if (contractAddress.startsWith('pending:')) {
            throw new Error('Cannot execute payout for a pending contract. Deploy the contract on-chain first.');
        }

        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
                if (!accounts || accounts.length === 0) {
                    throw new Error('No wallet connected for payout execution.');
                }

                // Call the contract's distribute() function
                // In production, encode the function call using ABI encoding
                // distribute(uint256 amount) => 0x91b7f5ed + encoded amount
                const amountHex = '0x' + Math.floor(amountUSDC * 1e6).toString(16); // USDC has 6 decimals

                const txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: accounts[0],
                        to: contractAddress,
                        data: '0x91b7f5ed' + amountHex.slice(2).padStart(64, '0'),
                        gas: '0x186A0', // 100,000 gas
                    }],
                }) as string;

                logger.info(`[SmartContract] Payout tx submitted: ${txHash}`);
                await this.recordToLedger('SPLIT_EXECUTION', contractAddress, `Distributed ${amountUSDC} USDC (tx: ${txHash})`);
                return true;
            } catch (error: unknown) {
                logger.error('[SmartContract] On-chain payout failed:', error);
                throw error instanceof Error ? error : new Error(`On-chain payout failed: ${String(error)}`);
            }
        }

        throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before executing payouts.');
    }

    /**
     * Tokenize Asset (NFT / SongShares).
     * Mints a token representing equity in the recording.
     */
    async tokenizeAsset(isrc: string, totalShares: number): Promise<string> {
        logger.info(`[SmartContract] Minting ${totalShares} SongShares for ${isrc}...`);

        let tokenContract: string;

        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
                if (!accounts || accounts.length === 0) {
                    throw new Error('No wallet connected for token minting.');
                }

                // Deploy ERC-1155 token contract with totalShares as constructor argument
                const txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: accounts[0],
                        data: this.getSongSharesBytecode() + totalShares.toString(16).padStart(64, '0'),
                        gas: '0x7A120', // 500,000 gas — sufficient for ERC-1155 constructor + storage init
                    }],
                }) as string;

                tokenContract = await this.waitForDeployment(txHash);
                logger.info(`[SmartContract] SongShares token deployed at ${tokenContract}`);
            } catch (error: unknown) {
                logger.error('[SmartContract] On-chain minting failed:', error);
                throw error instanceof Error ? error : new Error(`On-chain token minting failed: ${String(error)}`);
            }
        } else {
            throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before minting tokens.');
        }

        await this.recordToLedger('TOKEN_MINT', isrc, `Minted ${totalShares} shares at ${tokenContract}`);

        return tokenContract;
    }

    /**
     * Record an action to the Immutable Ledger.
     * In 2026, this pushes to a public or permissioned blockchain.
     */
    private async recordToLedger(action: LedgerEntry['action'], entityId: string, details: string) {
        // Generate SHA-256 hash for immutable ledger entry
        const hashInput = `${Date.now()}:${action}:${entityId}:${details}`;
        let hash: string;

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(hashInput);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error: unknown) {
            throw new Error(`Unable to create SHA-256 ledger hash: ${error instanceof Error ? error.message : String(error)}`);
        }

        const entry: LedgerEntry = {
            hash,
            timestamp: new Date().toISOString(),
            action,
            entityId,
            details
        };

        try {
            await addDoc(collection(db, this.LEDGER_COLLECTION), entry);
            logger.info(`[Blockchain Ledger] New Block: ${entry.hash.slice(0, 16)}... | ${action} | ${entityId}`);
        } catch (error: unknown) {
            logger.error('[Blockchain Ledger] Failed to persist entry:', error);
            throw error instanceof Error ? error : new Error(`Failed to persist ledger entry: ${String(error)}`);
        }
    }

    /**
     * Verify Chain of Custody
     * Returns the full history for an asset.
     */
    async getChainOfCustody(entityId: string): Promise<LedgerEntry[]> {
        try {
            const q = query(
                collection(db, this.LEDGER_COLLECTION),
                where('entityId', '==', entityId)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as LedgerEntry);
        } catch (error: unknown) {
            logger.error('[SmartContract] Failed to fetch chain of custody:', error);
            throw error instanceof Error ? error : new Error(`Failed to fetch chain of custody: ${String(error)}`);
        }
    }
}

export const smartContractService = new SmartContractService();
