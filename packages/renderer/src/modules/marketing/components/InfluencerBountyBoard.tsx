import { useEffect, useState } from 'react';
import {
    Trophy, Plus, Link2, DollarSign, Copy, CheckCircle,
    Clock, Music, Video
} from 'lucide-react';
import { PersistedBountyLink, influencerBountyService } from '@/services/marketing/InfluencerBountyService';
import { useToast } from '@/core/context/ToastContext';

type ActionType = 'TikTok' | 'IG Reel' | 'YouTube Short';
type BountyStatus = 'link-only';

interface Bounty {
    id: string;
    track: string;
    reward: number;
    action?: string;
    influencer: string;
    link: string;
    status: BountyStatus;
    refCode: string;
}

const STATUS_STYLES: Record<BountyStatus, string> = {
    'link-only': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

const STATUS_LABELS: Record<BountyStatus, string> = {
    'link-only': 'Link only',
};

const mapPersistedBounty = (bounty: PersistedBountyLink): Bounty => ({
    id: bounty.id,
    track: bounty.trackName,
    reward: bounty.rewardAmount,
    action: bounty.action,
    influencer: bounty.influencerHandle,
    link: bounty.targetUrl,
    status: 'link-only',
    refCode: bounty.referralCode,
});

export default function InfluencerBountyBoard() {
    const [bounties, setBounties] = useState<Bounty[]>([]);
    const [trackInput, setTrackInput] = useState('');
    const [reward, setReward] = useState(50);
    const [action, setAction] = useState<ActionType>('TikTok');
    const [influencerName, setInfluencerName] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingBounties, setIsLoadingBounties] = useState(true);
    const toast = useToast();

    const availableTracks = Array.from(new Set(bounties.map(b => b.track))).filter(Boolean);
    const selectedTrack = trackInput || availableTracks[0] || '';

    useEffect(() => {
        let alive = true;

        const loadBounties = async () => {
            setIsLoadingBounties(true);
            try {
                const savedBounties = await influencerBountyService.listBountyLinks();
                if (!alive) {
                    return;
                }

                setBounties(savedBounties.map(mapPersistedBounty));
            } finally {
                if (alive) {
                    setIsLoadingBounties(false);
                }
            }
        };

        void loadBounties();

        return () => {
            alive = false;
        };
    }, []);

    const handleCreateBounty = async () => {
        if (!influencerName) return;
        setIsCreating(true);

        try {
            const bounty = await influencerBountyService.generateBountyLink(
                influencerName.startsWith('@') ? influencerName : `@${influencerName}`,
                selectedTrack,
                reward,
                action
            );

            const newBounty: Bounty = {
                id: bounty.id,
                track: selectedTrack,
                reward,
                action,
                influencer: bounty.influencerId,
                link: bounty.targetUrl,
                status: 'link-only',
                refCode: bounty.referralCode,
            };

            setBounties(prev => [newBounty, ...prev]);
            setInfluencerName('');
            toast.success("Referral link saved!");
        } catch (_error: unknown) {
            toast.error("Failed to save referral link.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyRefLink = (link: string, refCode: string) => {
        void navigator.clipboard.writeText(link);
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
                <p className="text-xs text-gray-500 mt-1">
                    Create referral links for micro-influencers to promote your sound. Saved links are available now;
                    tracking, leaderboard ranking, and payouts stay unavailable until the backend workers exist.
                </p>
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
                        {availableTracks.length > 0 && (
                            <select
                                value={selectedTrack}
                                onChange={e => setTrackInput(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-dept-marketing/50 appearance-none cursor-pointer"
                            >
                                {availableTracks.map(t => <option key={t} value={t} className="bg-[#111]">{t}</option>)}
                            </select>
                        )}
                        <input
                            type="text"
                            value={trackInput}
                            onChange={e => setTrackInput(e.target.value)}
                            placeholder={availableTracks.length > 0 ? 'Or type a new track name' : 'Track name'}
                            className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                        />
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
                            Saving Referral Link...
                        </>
                    ) : (
                        <>
                            <Plus size={15} />
                            Create Bounty + Save Link
                        </>
                    )}
                </button>
            </div>

            {/* Active Bounties List */}
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Saved Bounties</h3>
                <div className="space-y-2">
                    {isLoadingBounties ? (
                        <div className="py-12 text-center">
                            <Clock size={28} className="mx-auto text-gray-700 mb-3 animate-spin" />
                            <p className="text-sm text-gray-500">Loading saved referral links...</p>
                        </div>
                    ) : (
                        bounties.map(b => (
                            <div
                                key={b.id}
                                className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/8 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-white">{b.influencer}</span>
                                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLES[b.status]}`}>
                                                {STATUS_LABELS[b.status]}
                                            </span>
                                            {b.action && (
                                                <span className="text-[10px] text-gray-300 bg-white/5 px-1.5 py-0.5 rounded">
                                                    {b.action}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            {b.track} &nbsp;·&nbsp; ${b.reward} bounty
                                        </p>
                                        {b.link && (
                                            <p className="text-[10px] text-dept-marketing mt-0.5 truncate">
                                                <Link2 size={8} className="inline mr-1" />{b.link}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleCopyRefLink(b.link, b.refCode)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:border-white/20 transition-all flex-shrink-0"
                                        title={b.link}
                                    >
                                        {copiedCode === b.refCode
                                            ? <CheckCircle size={10} className="text-green-400" />
                                            : <Copy size={10} />
                                        }
                                        <span className="font-mono">{b.refCode}</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {!isLoadingBounties && bounties.length === 0 && (
                    <div className="py-12 text-center">
                        <Trophy size={28} className="mx-auto text-gray-700 mb-3" />
                        <p className="text-sm text-gray-500">No saved referral links yet.</p>
                        <p className="text-xs text-gray-600 mt-1">Use the form above to create your first link-only bounty.</p>
                    </div>
                )}
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <h3 className="text-xs font-bold text-amber-200 uppercase tracking-widest flex items-center gap-1.5">
                    <DollarSign size={11} /> Tracking Unavailable
                </h3>
                <p className="text-xs text-amber-100/80 mt-2 leading-5">
                    Click tracking, conversion attribution, payout processing, and influencer ranking are not wired in this build.
                    Saved referral links stay active, but the leaderboard will remain unavailable until the backend pipeline exists.
                </p>
                <p className="text-[10px] text-amber-100/60 mt-2">
                    Manual review only. No payout claims are shown from local state.
                </p>
            </div>
        </div>
    );
}
