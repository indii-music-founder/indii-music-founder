/**
 * BlockchainLedger — Item 128 (PRODUCTION_200)
 * Immutable audit trail from SmartContractService.getChainOfCustody().
 * Shows LedgerEntry timeline, hash display, IPFS sync mock.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Copy, CheckCircle2, RefreshCw, UploadCloud, Search, Hash } from 'lucide-react';
import { smartContractService, LedgerEntry } from '@/services/blockchain/SmartContractService';

const MOCK_ENTRIES: LedgerEntry[] = [
    { hash: 'hash_1709123456_0.8421', timestamp: '2026-03-01T10:23:00Z', action: 'UPLOAD', entityId: 'USRC17607001', details: 'Master audio uploaded and fingerprinted' },
    { hash: 'hash_1709234567_0.7231', timestamp: '2026-03-02T14:11:00Z', action: 'METADATA_UPDATE', entityId: 'USRC17607001', details: 'DDEX ERN metadata committed to ledger' },
    { hash: 'hash_1709345678_0.3341', timestamp: '2026-03-04T09:05:00Z', action: 'SPLIT_EXECUTION', entityId: 'USRC17607001', details: 'Contract deployed at 0x7f3e...a2b1' },
    { hash: 'hash_1709456789_0.1129', timestamp: '2026-03-06T18:44:00Z', action: 'TOKEN_MINT', entityId: 'USRC17607001', details: 'Minted 1000 SongShares at 0xToken3f2a' },
];

const ACTION_CONFIG: Record<LedgerEntry['action'], { color: string; bg: string; label: string }> = {
    UPLOAD: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Upload' },
    METADATA_UPDATE: { color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Metadata' },
    SPLIT_EXECUTION: { color: 'text-[#FFE135]', bg: 'bg-[#FFE135]/10', label: 'Split' },
    TOKEN_MINT: { color: 'text-green-400', bg: 'bg-green-400/10', label: 'Mint' },
};

function truncateHash(hash: string) {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 12)}...${hash.slice(-6)}`;
}

function formatTimestamp(ts: string) {
    try {
        return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return ts;
    }
}

export function BlockchainLedger() {
    const [entries, setEntries] = useState<LedgerEntry[]>(MOCK_ENTRIES);
    const [isrcQuery, setIsrcQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [ipfsSyncing, setIpfsSyncing] = useState(false);
    const [ipfsSynced, setIpfsSynced] = useState(false);
    const [copiedHash, setCopiedHash] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!isrcQuery.trim()) {
            setEntries(MOCK_ENTRIES);
            return;
        }
        setLoading(true);
        try {
            const result = await smartContractService.getChainOfCustody(isrcQuery.trim());
            setEntries(result.length > 0 ? result : MOCK_ENTRIES.filter(e => e.entityId.includes(isrcQuery.trim().toUpperCase())));
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [isrcQuery]);

    const handleIpfsSync = async () => {
        setIpfsSyncing(true);
        await new Promise(r => setTimeout(r, 2500));
        setIpfsSyncing(false);
        setIpfsSynced(true);
        setTimeout(() => setIpfsSynced(false), 4000);
    };

    const handleCopyHash = async (hash: string) => {
        await navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield size={18} className="text-[#FFE135]" />
                        Blockchain Ledger
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Immutable chain of custody for your rights</p>
                </div>
                <button
                    onClick={handleIpfsSync}
                    disabled={ipfsSyncing}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${ipfsSynced
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
                        } disabled:opacity-50`}
                >
                    {ipfsSyncing ? (
                        <RefreshCw size={12} className="animate-spin" />
                    ) : ipfsSynced ? (
                        <CheckCircle2 size={12} />
                    ) : (
                        <UploadCloud size={12} />
                    )}
                    {ipfsSyncing ? 'Syncing...' : ipfsSynced ? 'Pinned to IPFS' : 'Sync to IPFS'}
                </button>
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                    <input
                        type="text"
                        value={isrcQuery}
                        onChange={e => setIsrcQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search by ISRC..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
                >
                    {loading ? <RefreshCw size={12} className="animate-spin" /> : 'Search'}
                </button>
            </div>

            {/* Ledger Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-4 bottom-4 w-px bg-white/5" />

                <div className="space-y-4 pl-12 relative">
                    <AnimatePresence mode="popLayout">
                        {entries.map((entry, i) => {
                            const cfg = ACTION_CONFIG[entry.action];
                            return (
                                <motion.div
                                    key={entry.hash}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="relative"
                                >
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-9 top-3 w-3 h-3 rounded-full ${cfg.bg} border-2 border-current ${cfg.color} flex items-center justify-center`} />

                                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:border-white/10 transition-all">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                                <span className="text-[10px] text-neutral-600">{formatTimestamp(entry.timestamp)}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-300 mb-2">{entry.details}</p>
                                        <div className="flex items-center gap-2 bg-black/30 rounded-lg px-2 py-1.5">
                                            <Hash size={10} className="text-neutral-600 flex-shrink-0" />
                                            <span className="text-[10px] text-neutral-500 font-mono flex-1 truncate">{truncateHash(entry.hash)}</span>
                                            <button
                                                onClick={() => handleCopyHash(entry.hash)}
                                                className="text-neutral-600 hover:text-white transition-colors flex-shrink-0"
                                            >
                                                {copiedHash === entry.hash ? <CheckCircle2 size={10} className="text-green-400" /> : <Copy size={10} />}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {entries.length === 0 && !loading && (
                        <div className="py-12 text-center">
                            <Shield size={24} className="mx-auto text-neutral-700 mb-3" />
                            <p className="text-sm text-neutral-500">No ledger entries found for this ISRC.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
