/**
 * Item 236: WalletConnect v2 Integration Service
 *
 * Provides wallet connection capabilities for Web3 features.
 * Supports window.ethereum (MetaMask) and WalletConnect Cloud (Reown) for multi-chain wallet connectivity.
 *
 * Setup: Get a free projectId from https://cloud.reown.com
 * Env: VITE_WALLETCONNECT_PROJECT_ID
 */

import { logger } from '@/utils/logger';

export interface WalletInfo {
    address: string;
    chainId: number;
    chainName: string;
    isConnected: boolean;
}

export interface WalletConnectConfig {
    projectId: string;
    chains: number[];
    metadata: {
        name: string;
        description: string;
        url: string;
        icons: string[];
    };
}

const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    137: 'Polygon',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base',
    56: 'BNB Chain'
};

const DEFAULT_CHAINS = [1, 137, 42161]; // Ethereum, Polygon, Arbitrum

export class WalletConnectService {
    private projectId: string;
    private connectedWallet: WalletInfo | null = null;
    private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

    constructor() {
        this.projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
    }

    /**
     * Check if WalletConnect is configured with a valid project ID.
     */
    isConfigured(): boolean {
        return this.projectId.length > 0 && this.projectId !== 'MOCK_KEY_DO_NOT_USE';
    }

    /**
     * Check if a browser wallet (MetaMask, etc.) is available.
     */
    hasInjectedProvider(): boolean {
        return typeof window !== 'undefined' && !!window.ethereum;
    }

    /**
     * Get the WalletConnect configuration for AppKit initialization.
     */
    getConfig(): WalletConnectConfig {
        if (!this.isConfigured()) {
            throw new Error('WalletConnect project ID not configured. Set VITE_WALLETCONNECT_PROJECT_ID in .env');
        }

        return {
            projectId: this.projectId,
            chains: DEFAULT_CHAINS,
            metadata: {
                name: 'indiiOS Studio',
                description: 'AI-native creative platform for independent music producers',
                url: 'https://indiios.com',
                icons: ['https://indiios.com/icon.png'],
            },
        };
    }

    /**
     * Connect to a wallet via window.ethereum (MetaMask) or WalletConnect modal.
     * Item 236: Real implementation using EIP-1193 provider detection.
     */
    async connect(): Promise<WalletInfo> {
        // Strategy 1: Use injected provider (MetaMask, Brave Wallet, etc.)
        if (this.hasInjectedProvider()) {
            return await this.connectViaInjectedProvider();
        }

        // Strategy 2: WalletConnect modal (requires projectId)
        if (this.isConfigured()) {
            return await this.connectViaWalletConnect();
        }

        // No provider available
        throw new Error(
            'No wallet provider detected. Install MetaMask or configure VITE_WALLETCONNECT_PROJECT_ID for WalletConnect.'
        );
    }

    /**
     * Connect via injected provider (MetaMask, Brave Wallet, Coinbase Wallet, etc.)
     */
    private async connectViaInjectedProvider(): Promise<WalletInfo> {
        logger.info('[WalletConnect] Connecting via injected provider (MetaMask/Brave)...');

        try {
            // Request account access — this triggers the MetaMask popup
            const accounts = await window.ethereum!.request({
                method: 'eth_requestAccounts'
            }) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('User rejected the connection request.');
            }

            // Get the current chain ID
            const chainIdHex = await window.ethereum!.request({
                method: 'eth_chainId'
            }) as string;
            const chainId = parseInt(chainIdHex, 16);
            const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

            this.connectedWallet = {
                address: accounts[0]!,
                chainId,
                chainName,
                isConnected: true,
            };

            // Listen for account and chain changes
            this.setupProviderListeners();

            this.emit('connect', this.connectedWallet);
            logger.info(`[WalletConnect] Connected to ${chainName}: ${accounts[0]!.slice(0, 6)}...${accounts[0]!.slice(-4)}`);

            return this.connectedWallet!;
        } catch (error: unknown) {
            logger.error('[WalletConnect] Injected provider connection failed:', error);
            throw new Error(`Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Connect via WalletConnect Cloud (Reown AppKit).
     * Requires VITE_WALLETCONNECT_PROJECT_ID.
     */
    private async connectViaWalletConnect(): Promise<WalletInfo> {
        logger.info('[WalletConnect] Initiating WalletConnect modal with projectId:', this.projectId.substring(0, 8) + '...');

        // WalletConnect Cloud requires the @reown/appkit SDK which is loaded dynamically
        // For the MVP phase, we guide users to install MetaMask
        // The full WalletConnect QR integration requires the Reown AppKit React SDK
        throw new Error(
            'WalletConnect QR modal requires @reown/appkit. ' +
            'For now, install MetaMask or another browser wallet. ' +
            'WalletConnect Cloud integration coming in v0.2.0.'
        );
    }

    /**
     * Setup listeners for account and chain changes from the injected provider.
     */
    private setupProviderListeners(): void {
        if (!window.ethereum) return;

        window.ethereum.on?.('accountsChanged', (...args: unknown[]) => {
            const accounts = args[0] as string[];
            if (accounts.length === 0) {
                this.connectedWallet = null;
                this.emit('disconnect');
                logger.info('[WalletConnect] Wallet disconnected (accounts changed to empty).');
            } else {
                if (this.connectedWallet) {
                    this.connectedWallet.address = accounts[0]!;
                    this.emit('accountsChanged', this.connectedWallet);
                }
            }
        });

        window.ethereum.on?.('chainChanged', (...args: unknown[]) => {
            const chainIdHex = args[0] as string;
            const chainId = parseInt(chainIdHex, 16);
            const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
            if (this.connectedWallet) {
                this.connectedWallet.chainId = chainId;
                this.connectedWallet.chainName = chainName;
                this.emit('chainChanged', this.connectedWallet);
                logger.info(`[WalletConnect] Chain switched to ${chainName} (${chainId}).`);
            }
        });
    }

    /**
     * Disconnect the currently connected wallet.
     */
    async disconnect(): Promise<void> {
        this.connectedWallet = null;
        this.emit('disconnect');
        logger.info('[WalletConnect] Wallet disconnected.');
    }

    /**
     * Get the currently connected wallet info, if any.
     */
    getConnectedWallet(): WalletInfo | null {
        return this.connectedWallet;
    }

    /**
     * Subscribe to wallet events.
     */
    on(event: string, callback: (...args: unknown[]) => void): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    /**
     * Unsubscribe from wallet events.
     */
    off(event: string, callback: (...args: unknown[]) => void): void {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, ...args: unknown[]): void {
        this.listeners.get(event)?.forEach(cb => cb(...args));
    }
}

export const walletConnectService = new WalletConnectService();
