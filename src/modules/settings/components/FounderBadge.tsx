/**
 * FounderBadge — Studio settings component for users with tier === 'founder'
 *
 * Shown in the Profile section. Displays:
 * - Gold founders badge with seat number
 * - Covenant hash (their permanent receipt)
 * - Link to verify the hash in the git repository
 * - Summary of founder benefits
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useStore, type StoreState } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

interface FounderData {
    seat: number;
    name: string;
    joinedAt: string;
    covenantHash: string;
    covenantVersion: string;
}

export default function FounderBadge() {
    const { user } = useStore(useShallow((s: StoreState) => ({ user: s.user })));
    const [founder, setFounder] = useState<FounderData | null>(null);
    const [loading, setLoading] = useState(true);
    const [hashCopied, setHashCopied] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;
        const db = getFirestore();
        getDoc(doc(db, 'founders', user.uid))
            .then((snap) => {
                if (snap.exists()) {
                    setFounder(snap.data() as FounderData);
                }
            })
            .catch(() => { /* non-fatal */ })
            .finally(() => setLoading(false));
    }, [user?.uid]);

    const copyHash = async () => {
        if (!founder?.covenantHash) return;
        try {
            await navigator.clipboard.writeText(founder.covenantHash);
            setHashCopied(true);
            setTimeout(() => setHashCopied(false), 2000);
        } catch (err) {
            console.error('[FounderBadge] Clipboard write failed:', err);
        }
    };

    if (loading || !founder) return null;

    const joinedDate = new Date(founder.joinedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const verifyUrl = `https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron/blob/main/src/config/founders.ts`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-black/40 to-amber-950/10"
        >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-amber-500/10 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg">◈</span>
                    <span className="text-amber-300 font-bold text-sm tracking-wide">Founding Member</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                    <span className="text-amber-400 font-mono text-xs font-bold">SEAT #{founder.seat}</span>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Name + date */}
                <div>
                    <p className="text-white font-semibold">{founder.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Founder since {joinedDate}</p>
                </div>

                {/* Covenant hash */}
                <div>
                    <p className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1.5">Covenant Hash (your receipt)</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-amber-300/80 bg-black/40 px-3 py-2 rounded-xl border border-white/5 truncate">
                            {founder.covenantHash}
                        </code>
                        <button
                            onClick={copyHash}
                            className="shrink-0 px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-mono"
                        >
                            {hashCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5 font-mono">
                        SHA-256({founder.name}|{founder.covenantVersion || '1.0.0'}|{founder.joinedAt})
                    </p>
                </div>

                {/* Benefits summary */}
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { label: 'Access', value: 'Lifetime' },
                        { label: 'AI Costs', value: 'Pass-through' },
                        { label: 'Projects', value: 'Unlimited' },
                        { label: 'Storage', value: '10 TB' },
                    ].map((item) => (
                        <div key={item.label} className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                            <p className="text-[10px] text-slate-500 font-mono uppercase">{item.label}</p>
                            <p className="text-sm text-amber-300 font-semibold mt-0.5">{item.value}</p>
                        </div>
                    ))}
                </div>

                {/* Verify link */}
                <a
                    href={verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors font-mono"
                >
                    <span>↗</span>
                    Verify your covenant in the repository
                </a>
            </div>
        </motion.div>
    );
}
