/**
 * PODIntegrationPanel — Item 121 (PRODUCTION_200)
 * Print-On-Demand API integration hub for Printful, Printify, Gooten.
 * Mock OAuth connect flow with catalog sync status.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Link2, Unlink } from 'lucide-react';

interface PODPartner {
    id: string;
    name: string;
    logo: string;
    description: string;
    products: number;
    status: 'connected' | 'disconnected' | 'pending';
    lastSync?: string;
}

const INITIAL_PARTNERS: PODPartner[] = [
    {
        id: 'printful',
        name: 'Printful',
        logo: 'PF',
        description: 'T-shirts, hoodies, posters, accessories worldwide.',
        products: 312,
        status: 'connected',
        lastSync: '2 hours ago',
    },
    {
        id: 'printify',
        name: 'Printify',
        logo: 'PY',
        description: 'Largest supplier network. Competitive margins.',
        products: 487,
        status: 'connected',
        lastSync: '5 hours ago',
    },
    {
        id: 'gooten',
        name: 'Gooten',
        logo: 'GT',
        description: 'Premium products, global fulfillment centers.',
        products: 158,
        status: 'disconnected',
    },
];

export function PODIntegrationPanel() {
    const [partners, setPartners] = useState<PODPartner[]>(INITIAL_PARTNERS);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);

    const handleConnect = async (id: string) => {
        setConnecting(id);
        await new Promise(r => setTimeout(r, 1500));
        setPartners(prev => prev.map(p => p.id === id ? { ...p, status: 'connected', lastSync: 'Just now', products: Math.floor(Math.random() * 200) + 100 } : p));
        setConnecting(null);
    };

    const handleDisconnect = (id: string) => {
        setPartners(prev => prev.map(p => p.id === id ? { ...p, status: 'disconnected', lastSync: undefined } : p));
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        await new Promise(r => setTimeout(r, 2000));
        setPartners(prev => prev.map(p => p.id === id ? { ...p, lastSync: 'Just now' } : p));
        setSyncing(null);
    };

    const connectedCount = partners.filter(p => p.status === 'connected').length;
    const totalProducts = partners.filter(p => p.status === 'connected').reduce((sum, p) => sum + p.products, 0);

    return (
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
                {partners.map((partner) => (
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
                                        onClick={() => handleConnect(partner.id)}
                                        disabled={connecting === partner.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE135]/10 border border-[#FFE135]/20 text-[#FFE135] rounded-lg text-[10px] font-bold hover:bg-[#FFE135]/20 transition-all disabled:opacity-50"
                                    >
                                        {connecting === partner.id ? (
                                            <RefreshCw size={10} className="animate-spin" />
                                        ) : (
                                            <Link2 size={10} />
                                        )}
                                        {connecting === partner.id ? 'Connecting...' : 'Connect'}
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
    );
}
