
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
 * Browser-side keyed RPC URLs are disabled. Wallet operations use
 * `window.ethereum`; receipt polling uses the fixed public Cloudflare gateway
 * until a secured backend resolver is available.
 */

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

    /**
     * Deploy a Smart Contract for Royalty Splits
     * ISSUE-1261: Draft transaction data is marked unverified.
     * We no longer deploy directly from the client using hand-built calldata.
     */
    async deploySplitContract(config: SplitContractConfig): Promise<string> {
        logger.info(`[SmartContract] Drafting Split Contract deployment for ISRC: ${config.isrc}...`);

        // Validate splits sum to 100%
        const total = config.payees.reduce((sum, p) => sum + p.percentage, 0);
        if (Math.abs(total - 100) > 0.01) {
            throw new Error(`Invalid Split Configuration: Total is ${total}%, must be 100%.`);
        }

        if (typeof window !== 'undefined' && window.ethereum) {
            const accounts = await (window.ethereum as any).request({ method: 'eth_accounts' }) as string[];
            if (!accounts || accounts.length === 0) {
                throw new Error('No wallet connected. Connect MetaMask or WalletConnect first.');
            }
        } else {
            throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before deploying contracts.');
        }

        // Persist Contract Config to Firestore as unverified draft
        await addDoc(collection(db, this.CONTRACTS_COLLECTION), {
            ...config,
            contractAddress: 'pending:unverified',
            deployedAt: Timestamp.now(),
            status: 'draft_unverified',
        });

        // Do NOT write a success record to the ledger from the client!
        logger.warn('[SmartContract] On-chain deployment is disabled on the client. Draft saved as unverified.');
        throw new Error('Server-side smart contract deployment is not yet available. Draft transaction saved as unverified.');
    }

    /**
     * Execute a Payout via Smart Contract.
     * Takes incoming revenue (e.g. USDC) and distributes it according to the contract.
     * ISSUE-1261: Payout drafting fails closed on the client.
     */
    async executePayout(contractAddress: string, amountUSDC: number): Promise<boolean> {
        logger.info(`[SmartContract] Drafting Payout of ${amountUSDC} USDC via ${contractAddress}`);

        if (contractAddress.startsWith('pending:')) {
            throw new Error('Cannot execute payout for a pending contract. Deploy the contract on-chain first.');
        }

        if (typeof window !== 'undefined' && window.ethereum) {
            const accounts = await (window.ethereum as any).request({ method: 'eth_accounts' }) as string[];
            if (!accounts || accounts.length === 0) {
                throw new Error('No wallet connected for payout execution.');
            }
            
            logger.warn('[SmartContract] On-chain payout execution is disabled on the client.');
            throw new Error('Server-side smart contract execution is not yet available. Payout cannot be verified.');
        }

        throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before executing payouts.');
    }

    /**
     * Tokenize Asset (NFT / SongShares).
     * Mints a token representing equity in the recording.
     * ISSUE-1261: Token minting fails closed on the client.
     */
    async tokenizeAsset(isrc: string, totalShares: number): Promise<string> {
        logger.info(`[SmartContract] Drafting ${totalShares} SongShares mint for ${isrc}...`);

        if (typeof window !== 'undefined' && window.ethereum) {
            const accounts = await (window.ethereum as any).request({ method: 'eth_accounts' }) as string[];
            if (!accounts || accounts.length === 0) {
                throw new Error('No wallet connected for token minting.');
            }

            logger.warn('[SmartContract] On-chain token minting is disabled on the client.');
            throw new Error('Server-side smart contract token minting is not yet available. Action unverified.');
        }

        throw new Error('No wallet provider available. Connect MetaMask or WalletConnect before minting tokens.');
    }

    // Removed private recordToLedger() because ledger writes must be server-verified and backend-owned.

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
