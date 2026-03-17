/**
 * WalletConnectPanel — Item 236
 * Real wallet connection via window.ethereum (MetaMask EIP-1193)
 * and WalletConnect v2 URI deep-link for mobile wallets.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, CheckCircle2, Copy, LogOut, Link2, Shield, AlertCircle } from 'lucide-react';
import { walletConnectService } from '@/services/web3/WalletConnectService';

const STORAGE_KEY = 'indii_wallet_address';
const CHAIN_KEY = 'indii_wallet_chain';

type WalletProvider = 'metamask' | 'walletconnect';

function truncateAddress(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function chainName(chainId: string): string {
    const chains: Record<string, string> = {
        '0x1': 'Ethereum', '0x89': 'Polygon', '0xa4b1': 'Arbitrum',
        '0x38': 'BNB Chain', '0xa': 'Optimism',
    };
    return chains[chainId] || `Chain ${parseInt(chainId, 16)}`;
}

declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            isMetaMask?: boolean;
            on?: (event: string, handler: (...args: unknown[]) => void) => void;
            removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
        };
    }
}

export function WalletConnectPanel() {
    const [address, setAddress] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
    const [chain, setChain] = useState<string>(() => localStorage.getItem(CHAIN_KEY) || '0x1');
    const [connecting, setConnecting] = useState<WalletProvider | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Listen for MetaMask account/chain changes
    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum?.on) return;

        const onAccountsChanged = (...args: unknown[]) => {
            const accounts = args[0] as string[];
            if (accounts.length === 0) {
                handleDisconnect();
            } else {
                localStorage.setItem(STORAGE_KEY, accounts[0]);
                setAddress(accounts[0]);
            }
        };
        const onChainChanged = (...args: unknown[]) => {
            const id = args[0] as string;
            localStorage.setItem(CHAIN_KEY, id);
            setChain(id);
        };

        window.ethereum.on('accountsChanged', onAccountsChanged);
        window.ethereum.on('chainChanged', onChainChanged);

        return () => {
            window.ethereum?.removeListener?.('accountsChanged', onAccountsChanged);
            window.ethereum?.removeListener?.('chainChanged', onChainChanged);
        };
    }, []);

    const handleConnect = async (provider: WalletProvider) => {
        setConnecting(provider);
        setError(null);

        try {
            if (provider === 'metamask') {
                if (typeof window === 'undefined' || !window.ethereum) {
                    throw new Error('MetaMask not installed. Please install the MetaMask browser extension.');
                }
                // Request account access via EIP-1193
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
                const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;

                localStorage.setItem(STORAGE_KEY, accounts[0]);
                localStorage.setItem(CHAIN_KEY, chainId);
                setAddress(accounts[0]);
                setChain(chainId);

            } else {
                // WalletConnect v2: uses WalletConnectService (backed by @reown/appkit when project ID is set)
                if (!walletConnectService.isConfigured()) {
                    throw new Error(
                        'WalletConnect project ID not set. Add VITE_WALLETCONNECT_PROJECT_ID to .env ' +
                        '(get a free key at cloud.reown.com)'
                    );
                }
                const info = await walletConnectService.connect();
                if (info.address) {
                    localStorage.setItem(STORAGE_KEY, info.address);
                    localStorage.setItem(CHAIN_KEY, `0x${info.chainId.toString(16)}`);
                    setAddress(info.address);
                    setChain(`0x${info.chainId.toString(16)}`);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Connection failed';
            setError(msg);
        } finally {
            setConnecting(null);
        }
    };

    const handleDisconnect = () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CHAIN_KEY);
        setAddress(null);
        setError(null);
        walletConnectService.disconnect().catch((err) => { console.error('[WalletConnect] disconnect error:', err); });
    };

    const handleCopy = async () => {
        if (!address) return;
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wallet size={18} className="text-[#FFE135]" />
                    Web3 Wallet
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">Connect your wallet to enable smart contracts and NFT minting</p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <AnimatePresence mode="wait">
                {address ? (
                    <motion.div
                        key="connected"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-4"
                    >
                        {/* Connected State */}
                        <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                <CheckCircle2 size={18} className="text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-green-400 mb-0.5">Wallet Connected</div>
                                <div className="text-sm font-mono text-white">{truncateAddress(address)}</div>
                            </div>
                            <button onClick={handleCopy} className="p-2 rounded-lg bg-white/5 text-neutral-500 hover:text-white hover:bg-white/10 transition-all">
                                {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                        </div>

                        {/* Network Info */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                                <div className="text-xs font-bold text-white mb-0.5">Network</div>
                                <div className="text-[11px] text-blue-400 font-mono">{chainName(chain)}</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                                <div className="text-xs font-bold text-white mb-0.5">Chain ID</div>
                                <div className="text-[11px] text-[#FFE135] font-mono">{parseInt(chain, 16)}</div>
                            </div>
                        </div>

                        {/* Capabilities */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Enabled Features</h4>
                            {[
                                'Smart contract deployment',
                                'NFT / SongShares minting',
                                'Royalty split automation',
                                'Blockchain rights tracing',
                            ].map(feature => (
                                <div key={feature} className="flex items-center gap-2 text-xs text-neutral-400">
                                    <Shield size={10} className="text-green-400 flex-shrink-0" />
                                    {feature}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleDisconnect}
                            className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            <LogOut size={12} />
                            Disconnect Wallet
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="disconnected"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        <p className="text-xs text-neutral-500 text-center py-2">
                            Connect a wallet to unlock Web3 features
                        </p>

                        {/* MetaMask */}
                        <button
                            onClick={() => handleConnect('metamask')}
                            disabled={!!connecting}
                            className="w-full flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-orange-400/30 hover:bg-orange-400/5 transition-all group disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-xl bg-orange-400/10 border border-orange-400/20 flex items-center justify-center text-lg flex-shrink-0">
                                🦊
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">MetaMask</div>
                                <div className="text-[11px] text-neutral-500">
                                    {typeof window !== 'undefined' && window.ethereum?.isMetaMask
                                        ? 'Ready to connect'
                                        : 'Browser extension wallet'}
                                </div>
                            </div>
                            {connecting === 'metamask' ? (
                                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Link2 size={14} className="text-neutral-600 group-hover:text-orange-400 transition-colors" />
                            )}
                        </button>

                        {/* WalletConnect */}
                        <button
                            onClick={() => handleConnect('walletconnect')}
                            disabled={!!connecting}
                            className="w-full flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-blue-400/30 hover:bg-blue-400/5 transition-all group disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center text-lg flex-shrink-0">
                                🔗
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">WalletConnect</div>
                                <div className="text-[11px] text-neutral-500">
                                    {walletConnectService.isConfigured() ? 'Scan QR with any mobile wallet' : 'Requires VITE_WALLETCONNECT_PROJECT_ID'}
                                </div>
                            </div>
                            {connecting === 'walletconnect' ? (
                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Link2 size={14} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
                            )}
                        </button>

                        <p className="text-center text-[10px] text-neutral-700 pt-2">
                            Real wallet required · Transactions on connected chain
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
