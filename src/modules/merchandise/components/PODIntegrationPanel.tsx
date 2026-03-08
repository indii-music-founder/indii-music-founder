/**
 * PODIntegrationPanel — Item 121 (PRODUCTION_200)
 * Print-On-Demand API integration hub for Printful, Printify, Gooten.
 * Real API key storage via PODCredentialService + real catalog sync.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Link2, Unlink, Key, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PODCredentialService } from '@/services/pod/PODCredentialService';
import { PrintOnDemandService, PODProvider } from '@/services/pod/PrintOnDemandService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

interface PODPartner {
    id: PODProvider;
    name: string;
    logo: string;
    description: string;
    docsUrl: string;
    products: number;
    status: 'connected' | 'disconnected' | 'pending';
    lastSync?: string;
}

const PARTNER_METADATA: Omit<PODPartner, 'products' | 'status' | 'lastSync'>[] = [
    {
        id: 'printful',
        name: 'Printful',
        logo: 'PF',
        description: 'T-shirts, hoodies, posters, accessories worldwide.',
        docsUrl: 'https://www.printful.com/dashboard',
    },
    {
        id: 'printify',
        name: 'Printify',
        logo: 'PY',
        description: 'Largest supplier network. Competitive margins.',
        docsUrl: 'https://printify.com/app/store/products',
    },
    {
        id: 'gooten',
        name: 'Gooten',
        logo: 'GT',
        description: 'Premium products, global fulfillment centers.',
        docsUrl: 'https://www.gooten.com',
    },
];

interface ApiKeyModalProps {
    provider: PODPartner;
    onConfirm: (apiKey: string) => Promise<void>;
    onClose: () => void;
}

function ApiKeyModal({ provider, onConfirm, onClose }: ApiKeyModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;

        setValidating(true);
        setError(null);

        const valid = await PODCredentialService.validateKey(provider.id, apiKey.trim());
        if (!valid) {
            setError('API key validation failed. Please check your key and try again.');
            setValidating(false);
            return;
        }

        await onConfirm(apiKey.trim());
        setValidating(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Key size={16} className="text-[#FFE135]" />
                        <h3 className="text-sm font-bold text-white">Connect {provider.name}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <p className="text-xs text-neutral-500 mb-4">
                    Enter your {provider.name} API key. Your key is stored securely in Firestore,
                    scoped to your account.
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder={`${provider.name} API key`}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(prev => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                        >
                            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 text-neutral-400 rounded-lg text-sm hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!apiKey.trim() || validating}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#FFE135]/10 border border-[#FFE135]/20 text-[#FFE135] rounded-lg text-sm font-bold hover:bg-[#FFE135]/20 transition-all disabled:opacity-50"
                        >
                            {validating ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                            {validating ? 'Validating…' : 'Connect'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

export function PODIntegrationPanel() {
    const { user } = useStore(useShallow(s => ({ user: s.user })));
    const userId = user?.uid ?? null;

    const [partners, setPartners] = useState<PODPartner[]>(
        PARTNER_METADATA.map(m => ({ ...m, products: 0, status: 'disconnected' as const }))
    );
    const [syncing, setSyncing] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<PODPartner | null>(null);
    const [loading, setLoading] = useState(true);

    // Load stored credentials on mount
    useEffect(() => {
        if (!userId) {
            // Defer state update to avoid synchronous setState in effect
            const t = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(t);
        }
        let cancelled = false;
        (async () => {
            const creds = await PODCredentialService.loadAllCredentials(userId);
            if (cancelled) return;
            setPartners(prev => prev.map(p => ({
                ...p,
                status: creds[p.id] ? 'connected' : 'disconnected',
                lastSync: creds[p.id] ? 'Never synced' : undefined,
            })));
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const handleConfirmConnect = async (provider: PODPartner, apiKey: string) => {
        if (!userId) return;
        await PODCredentialService.saveCredential(userId, provider.id, apiKey);
        // Trigger initial sync
        await doSync(provider.id, apiKey);
        setPartners(prev => prev.map(p =>
            p.id === provider.id ? { ...p, status: 'connected', lastSync: new Date().toLocaleTimeString() } : p
        ));
        setConnecting(null);
    };

    const handleDisconnect = async (id: PODProvider) => {
        if (!userId) return;
        await PODCredentialService.removeCredential(userId, id);
        setPartners(prev => prev.map(p =>
            p.id === id ? { ...p, status: 'disconnected', lastSync: undefined, products: 0 } : p
        ));
    };

    const doSync = async (id: PODProvider, _apiKey?: string) => {
        try {
            const products = await PrintOnDemandService.getProducts(id);
            setPartners(prev => prev.map(p =>
                p.id === id
                    ? { ...p, products: products.length, lastSync: new Date().toLocaleTimeString() }
                    : p
            ));
        } catch {
            // Sync failure is non-blocking — keep existing product count
        }
    };

    const handleSync = async (id: PODProvider) => {
        setSyncing(id);
        await doSync(id);
        setSyncing(null);
    };

    const connectedCount = partners.filter(p => p.status === 'connected').length;
    const totalProducts = partners.filter(p => p.status === 'connected').reduce((sum, p) => sum + p.products, 0);

    return (
        <>
            {connecting && (
                <ApiKeyModal
                    provider={connecting}
                    onConfirm={apiKey => handleConfirmConnect(connecting, apiKey)}
                    onClose={() => setConnecting(null)}
                />
            )}

            <div className="p-6 space-y-6">
                {/* Header Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-[#FFE135]">{connectedCount}</div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Connected</div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-white">{totalProducts.toLocaleString()}</div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Products</div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-green-400">24h</div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Fulfillment</div>
                    </div>
                </div>

                {/* Partner Cards */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">POD Partners</h3>

                    {loading && (
                        <div className="flex items-center justify-center py-8 text-neutral-500">
                            <Loader2 size={18} className="animate-spin mr-2" />
                            Loading integrations…
                        </div>
                    )}

                    {!loading && partners.map((partner) => (
                        <motion.div
                            key={partner.id}
                            layout
                            className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all"
                        >
                            <div className="flex items-start gap-3">
                                {/* Logo */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${partner.status === 'connected' ? 'bg-[#FFE135]/10 text-[#FFE135]' : 'bg-white/5 text-neutral-500'}`}>
                                    {partner.logo}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-bold text-white">{partner.name}</span>
                                        {partner.status === 'connected' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
                                                <CheckCircle2 size={10} /> Live
                                            </span>
                                        )}
                                        {partner.status === 'disconnected' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-600">
                                                <AlertCircle size={10} /> Not connected
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-snug">{partner.description}</p>
                                    {partner.status === 'connected' && (
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] text-neutral-600">
                                                <span className="text-neutral-400 font-bold">{partner.products}</span> products synced
                                            </span>
                                            {partner.lastSync && (
                                                <span className="text-[10px] text-neutral-600">Last sync: {partner.lastSync}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {partner.status === 'connected' ? (
                                        <>
                                            <button
                                                onClick={() => handleSync(partner.id)}
                                                disabled={syncing === partner.id}
                                                className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                                                title="Sync catalog"
                                            >
                                                <RefreshCw size={12} className={syncing === partner.id ? 'animate-spin' : ''} />
                                            </button>
                                            <button
                                                onClick={() => handleDisconnect(partner.id)}
                                                className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                                title="Disconnect"
                                            >
                                                <Unlink size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setConnecting(partner)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE135]/10 border border-[#FFE135]/20 text-[#FFE135] rounded-lg text-[10px] font-bold hover:bg-[#FFE135]/20 transition-all"
                                        >
                                            <Key size={10} />
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center">
                    <a
                        href="https://www.printful.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
                    >
                        <ExternalLink size={10} />
                        Visit Printful Dashboard
                    </a>
                </div>
            </div>
        </>
    );
}
