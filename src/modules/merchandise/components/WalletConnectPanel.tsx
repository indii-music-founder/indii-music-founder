/**
 * WalletConnectPanel — Item 126 (PRODUCTION_200)
 * Web3 wallet connection UI (mock-first, no ethers.js).
 * MetaMask + WalletConnect options, stores address in localStorage.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, CheckCircle2, Copy, LogOut, Link2, Shield } from 'lucide-react';

const STORAGE_KEY = 'indii_wallet_address';

type WalletProvider = 'metamask' | 'walletconnect';

function truncateAddress(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function generateMockAddress(): string {
    const hex = () => Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    return `0x${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`.slice(0, 42);
}

export function WalletConnectPanel() {
    const [address, setAddress] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<WalletProvider | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setAddress(stored);
    }, []);

    const handleConnect = async (provider: WalletProvider) => {
        setConnecting(provider);
        await new Promise(r => setTimeout(r, 1800));
        const mockAddr = generateMockAddress();
        localStorage.setItem(STORAGE_KEY, mockAddr);
        setAddress(mockAddr);
        setConnecting(null);
    };

    const handleDisconnect = () => {
        localStorage.removeItem(STORAGE_KEY);
        setAddress(null);
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
                                <div className="text-[11px] text-blue-400 font-mono">Polygon (MATIC)</div>
                            </div>
                            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                                <div className="text-xs font-bold text-white mb-0.5">Balance</div>
                                <div className="text-[11px] text-[#FFE135] font-mono">0.00 USDC</div>
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
                                <div className="text-[11px] text-neutral-500">Browser extension wallet</div>
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
                                <div className="text-[11px] text-neutral-500">Scan QR with any mobile wallet</div>
                            </div>
                            {connecting === 'walletconnect' ? (
                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Link2 size={14} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
                            )}
                        </button>

                        <p className="text-center text-[10px] text-neutral-700 pt-2">
                            Mock-mode enabled · No real transactions
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
