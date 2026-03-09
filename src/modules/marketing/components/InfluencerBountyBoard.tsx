import React, { useState } from 'react';
import {
    Trophy, Plus, Link2, DollarSign, Copy, CheckCircle,
    Clock, Star, TrendingUp, Music, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { influencerBountyService } from '@/services/marketing/InfluencerBountyService';
import { useToast } from '@/core/context/ToastContext';

type ActionType = 'TikTok' | 'IG Reel' | 'YouTube Short';
type BountyStatus = 'pending' | 'verified' | 'paid';

interface Bounty {
    id: string;
    track: string;
    reward: number;
    action: ActionType;
    influencer: string;
    link: string;
    status: BountyStatus;
    refCode: string;
    views: number;
}

interface LeaderboardEntry {
    name: string;
    bounties: number;
    totalEarned: number;
    totalViews: string;
}

// No hardcoded data — bounties come from InfluencerBountyService/Firestore.
// Tracks and leaderboard are derived dynamically from bounty data.

const STATUS_STYLES: Record<BountyStatus, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    verified: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    paid: 'bg-green-500/10 text-green-400 border-green-500/20',
};


export default function InfluencerBountyBoard() {
    const [bounties, setBounties] = useState<Bounty[]>([]);
    const [trackInput, setTrackInput] = useState('');
    const [reward, setReward] = useState(50);
    const [action, setAction] = useState<ActionType>('TikTok');
    const [influencerName, setInfluencerName] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const toast = useToast();

    // Derive unique tracks from existing bounties
    const availableTracks = Array.from(new Set(bounties.map(b => b.track))).filter(Boolean);
    const selectedTrack = trackInput || availableTracks[0] || '';

    // Derive leaderboard dynamically from bounties
    const leaderboard = React.useMemo(() => {
        const byInfluencer = new Map<string, { bounties: number; totalEarned: number; totalViews: number }>();
        bounties.forEach(b => {
            const existing = byInfluencer.get(b.influencer) || { bounties: 0, totalEarned: 0, totalViews: 0 };
            existing.bounties++;
            if (b.status === 'paid') existing.totalEarned += b.reward;
            existing.totalViews += b.views;
            byInfluencer.set(b.influencer, existing);
        });
        return Array.from(byInfluencer.entries())
            .map(([name, data]) => ({
                name,
                bounties: data.bounties,
                totalEarned: data.totalEarned,
                totalViews: data.totalViews >= 1000000 ? `${(data.totalViews / 1000000).toFixed(1)}M` : data.totalViews >= 1000 ? `${(data.totalViews / 1000).toFixed(0)}K` : String(data.totalViews),
            }))
            .sort((a, b) => b.totalEarned - a.totalEarned)
            .slice(0, 10);
    }, [bounties]);

    const handleCreateBounty = async () => {
        if (!influencerName) return;
        setIsCreating(true);

        try {
            const bounty = await influencerBountyService.generateBountyLink(
                influencerName.startsWith('@') ? influencerName : `@${influencerName}`,
                selectedTrack,
                reward
            );

            const newBounty: Bounty = {
                id: bounty.id,
                track: selectedTrack,
                reward,
                action,
                influencer: bounty.influencerId,
                link: bounty.targetUrl,
                status: 'pending',
                refCode: bounty.referralCode,
                views: 0,
            };

            setBounties(prev => [newBounty, ...prev]);
            setInfluencerName('');
            toast.success("Bounty and referral link created!");
        } catch (error) {
            toast.error("Failed to create bounty.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyRefLink = (refCode: string) => {
        void navigator.clipboard.writeText(`https://indii.vip/ref/${refCode}`);
        setCopiedCode(refCode);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy size={18} className="text-dept-marketing" />
                    Influencer Bounty Board
                </h2>
                <p className="text-xs text-gray-500 mt-1">Create tracked referral campaigns for micro-influencers to promote your sound.</p>
            </div>

            {/* Create Bounty Form */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Plus size={11} /> Create Bounty
                </h3>

                <div className="grid grid-cols-2 gap-3">
                    {/* Track Picker */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Music size={9} /> Track
                        </label>
                        <select
                            value={selectedTrack}
                            onChange={e => setTrackInput(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-dept-marketing/50 appearance-none cursor-pointer"
                        >
                            {availableTracks.length > 0 ? (
                                availableTracks.map(t => <option key={t} value={t} className="bg-[#111]">{t}</option>)
                            ) : (
                                <option value="" className="bg-[#111]">Enter track name below</option>
                            )}
                        </select>
                        {availableTracks.length === 0 && (
                            <input
                                type="text"
                                value={trackInput}
                                onChange={e => setTrackInput(e.target.value)}
                                placeholder="Track name"
                                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                            />
                        )}
                    </div>

                    {/* Reward */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <DollarSign size={9} /> Reward
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                                type="number"
                                value={reward}
                                onChange={e => setReward(Number(e.target.value))}
                                min={10}
                                className="w-full pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-dept-marketing/50 outline-none"
                            />
                        </div>
                    </div>

                    {/* Required Action */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Video size={9} /> Required Action
                        </label>
                        <div className="flex gap-1.5">
                            {(['TikTok', 'IG Reel', 'YouTube Short'] as const).map(a => (
                                <button
                                    key={a}
                                    onClick={() => setAction(a)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${action === a
                                        ? 'bg-dept-marketing/20 border border-dept-marketing/40 text-dept-marketing'
                                        : 'bg-white/5 border border-white/10 text-gray-500 hover:border-white/20'
                                        }`}
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Influencer Name */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1">Influencer Handle</label>
                        <input
                            type="text"
                            value={influencerName}
                            onChange={e => setInfluencerName(e.target.value)}
                            placeholder="@username"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCreateBounty}
                    disabled={!influencerName || isCreating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 shadow-lg shadow-dept-marketing/20"
                >
                    {isCreating ? (
                        <>
                            <Clock size={15} className="animate-spin" />
                            Generating Tracking Node...
                        </>
                    ) : (
                        <>
                            <Plus size={15} />
                            Create Bounty + Generate Referral Link
                        </>
                    )}
                </button>
            </div>

            {/* Active Bounties List */}
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Active Bounties</h3>
                <div className="space-y-2">
                    {bounties.map(b => (
                        <div
                            key={b.id}
                            className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/8 transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-white">{b.influencer}</span>
                                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLES[b.status]}`}>
                                            {b.status}
                                        </span>
                                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">{b.action}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                        {b.track} &nbsp;·&nbsp; ${b.reward} reward
                                        {b.views > 0 && <> &nbsp;·&nbsp; {b.views.toLocaleString()} views</>}
                                    </p>
                                    {b.link && (
                                        <p className="text-[10px] text-dept-marketing mt-0.5 truncate">
                                            <Link2 size={8} className="inline mr-1" />{b.link}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleCopyRefLink(b.refCode)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:border-white/20 transition-all flex-shrink-0"
                                    title={`https://indii.vip/ref/${b.refCode}`}
                                >
                                    {copiedCode === b.refCode
                                        ? <CheckCircle size={10} className="text-green-400" />
                                        : <Copy size={10} />
                                    }
                                    <span className="font-mono">{b.refCode}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {bounties.length === 0 && (
                    <div className="py-12 text-center">
                        <Trophy size={28} className="mx-auto text-gray-700 mb-3" />
                        <p className="text-sm text-gray-500">No bounties created yet.</p>
                        <p className="text-xs text-gray-600 mt-1">Use the form above to create your first influencer bounty.</p>
                    </div>
                )}
            </div>

            {/* Leaderboard */}
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Star size={11} /> Top Influencers
                </h3>
                <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.03]">
                                {['#', 'Handle', 'Bounties', 'Total Views', 'Earned'].map(col => (
                                    <th key={col} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.length > 0 ? leaderboard.map((e, i) => (
                                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                    <td className="px-3 py-2.5 text-gray-600 font-bold">#{i + 1}</td>
                                    <td className="px-3 py-2.5 text-white font-medium">{e.name}</td>
                                    <td className="px-3 py-2.5 text-gray-400">{e.bounties}</td>
                                    <td className="px-3 py-2.5 text-gray-400 flex items-center gap-1">
                                        <TrendingUp size={9} className="text-green-400" />{e.totalViews}
                                    </td>
                                    <td className="px-3 py-2.5 text-green-400 font-semibold">${e.totalEarned}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-gray-600 text-xs">No influencer data yet. Create bounties to populate the leaderboard.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
