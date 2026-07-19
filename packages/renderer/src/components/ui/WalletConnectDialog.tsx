import React, { useState } from 'react';
import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { WalletInfo } from '@/services/web3/WalletConnectService';
import { Link2, AlertCircle } from 'lucide-react';
import { logger } from '@/utils/logger';

export const WalletConnectDialog = createCallable<Record<string, never>, WalletInfo | null>(({ call }) => {
    const [connecting, setConnecting] = useState<'metamask' | 'walletconnect' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined;

    const handleConnect = async (provider: 'metamask' | 'walletconnect') => {
        setConnecting(provider);
        setError(null);
        try {
            if (provider === 'metamask') {
                if (!ethereum) {
                    throw new Error('MetaMask not installed. Please install the browser extension.');
                }
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
                const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
                
                call.end({
                    address: accounts[0],
                    chainId: parseInt(chainId, 16),
                    chainName: 'Ethereum', 
                    isConnected: true
                });
            } else {
                throw new Error('WalletConnect is temporarily unavailable while its upstream web3 dependency chain is remediated. Use MetaMask or another injected browser wallet.');
            }
        } catch (err: unknown) {
            logger.error('[WalletConnectDialog] Error:', err);
            setError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setConnecting(null);
        }
    };

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="wallet-connect-title" maxWidth="max-w-md">
            <div className="p-6 space-y-6">
                <div>
                    <h3 id="wallet-connect-title" className="text-xl font-bold text-white mb-2">Connect Wallet</h3>
                    <p className="text-sm text-neutral-400">Choose a provider to connect your Web3 wallet.</p>
                </div>

                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-3">
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
                                {ethereum ? 'Ready to connect' : 'Browser extension wallet'}
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
                        disabled={true}
                        className="w-full flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl opacity-50 cursor-not-allowed"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center text-lg flex-shrink-0">
                            🔗
                        </div>
                        <div className="flex-1 text-left">
                            <div className="text-sm font-bold text-white">WalletConnect</div>
                            <div className="text-[11px] text-neutral-500">Temporarily unavailable</div>
                        </div>
                        {connecting === 'walletconnect' ? (
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Link2 size={14} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
});
