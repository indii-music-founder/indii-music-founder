/**
 * Item 236: WalletConnect v2 Integration Service
 *
 * Provides wallet connection capabilities for Web3 features.
 * Uses WalletConnect Cloud (Reown) for multi-chain wallet connectivity.
 *
 * Setup: Get a free projectId from https://cloud.reown.com
 * Env: VITE_WALLETCONNECT_PROJECT_ID
 */

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
     * Connect to a wallet via WalletConnect modal.
     * In production, this would open the WalletConnect QR modal.
     */
    async connect(): Promise<WalletInfo> {
        if (!this.isConfigured()) {
            throw new Error('WalletConnect not configured');
        }

        // TODO: Integrate with @reown/appkit when projectId is available
        // For now, return a structured placeholder that the UI can render
        console.log('[WalletConnect] Initiating connection with projectId:', this.projectId.substring(0, 8) + '...');

        return {
            address: '',
            chainId: 1,
            chainName: 'Ethereum',
            isConnected: false,
        };
    }

    /**
     * Disconnect the currently connected wallet.
     */
    async disconnect(): Promise<void> {
        this.connectedWallet = null;
        this.emit('disconnect');
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
