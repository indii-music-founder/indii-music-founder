import React from 'react';
import { CampaignAsset, CampaignStatus } from '../types';
import { Calendar, ChevronRight, Activity } from 'lucide-react';
import { motion } from 'motion/react';

// Fix for React 19 type mismatch with Lucide
const CalendarIcon = Calendar as React.FC<{ size?: number; className?: string }>;
const ChevronRightIcon = ChevronRight as React.FC<{ size?: number; className?: string }>;
const ActivityIcon = Activity as React.FC<{ size?: number; className?: string }>;

interface CampaignCardProps {
    campaign: CampaignAsset;
    onSelect: (campaign: CampaignAsset) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
    const isActive = campaign.status === CampaignStatus.EXECUTING;
    const isDone = campaign.status === CampaignStatus.DONE;
    const isFailed = campaign.status === CampaignStatus.FAILED;

    // Calculate progress based on posts done vs total posts
    const completedPosts = (campaign.posts || []).filter(p => p.status === CampaignStatus.DONE).length;
    const progress = Math.round((completedPosts / (campaign.posts?.length || 1)) * 100) || 0;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(campaign);
        }
    };

    return (
        <motion.div
            role="button"
            tabIndex={0}
            aria-label={`Select campaign: ${campaign.title}`}
            onKeyDown={handleKeyDown}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(campaign)}
            className="group relative overflow-hidden rounded-2xl bg-[#14100C]/80 border border-white/10 backdrop-blur-xl cursor-pointer transition-all duration-300 hover:border-[#FFB800]/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_24px_rgba(255,184,0,0.12)] hover:bg-[#14100C] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FFB800] focus-visible:outline-none"
        >
            {/* Background Thermal Ambient Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFB800]/8 via-transparent to-[#E53935]/8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="p-6 relative z-10 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {isActive && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB800] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD700]"></span>
                                </span>
                            )}
                            <h3 className="text-base md:text-lg font-bold text-white group-hover:text-[#FFD700] group-focus-within:text-[#FFD700] transition-colors tracking-tight">
                                {campaign.title}
                            </h3>
                        </div>
                        <p className="text-xs md:text-sm text-gray-400 line-clamp-1">{campaign.description || "No description provided."}</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 py-1">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 group-hover:border-[#FFB800]/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 font-medium">
                            <ActivityIcon size={13} className="text-[#00B8D4]" />
                            <span>Posts</span>
                        </div>
                        <span className="text-lg font-bold text-gray-100">{campaign.posts?.length || 0}</span>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 group-hover:border-[#FFB800]/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 font-medium">
                            <CalendarIcon size={13} className="text-[#FFB800]" />
                            <span>Duration</span>
                        </div>
                        <span className="text-lg font-bold text-gray-100">{campaign.durationDays}d</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Campaign Progress">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span className="text-gray-300 font-medium">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden" aria-hidden="true">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isDone ? 'bg-[#00C853]' :
                                isActive ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100]' :
                                    'bg-white/20'
                                }`}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-2 flex justify-between items-center border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${isActive ? 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFD700]' :
                            isDone ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#00C853]' :
                                isFailed ? 'bg-[#E53935]/10 border-[#E53935]/30 text-red-400' :
                                    'bg-white/5 border-white/10 text-gray-400'
                            }`}>
                            {isActive ? 'Executing' : isDone ? 'Completed' : isFailed ? 'Failed' : 'Pending'}
                        </span>
                        <span className="text-gray-500 text-[11px]">{new Date(campaign.startDate).toLocaleDateString('en-US')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#FFB800] group-hover:translate-x-1 group-focus-within:translate-x-1 transition-transform">
                        Manage <ChevronRightIcon size={14} className="stroke-[2.5]" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ⚡ Bolt Optimization: Custom comparison to prevent re-renders when parent regenerates
// object references (e.g., from Firestore snapshot mapping) but the data hasn't changed.
// NOTE: If you add new rendered fields to CampaignCard, you MUST update this comparator.
function arePropsEqual(prevProps: CampaignCardProps, nextProps: CampaignCardProps) {
    const prev = prevProps.campaign;
    const next = nextProps.campaign;

    // 1. Check strict reference equality first (fastest)
    if (prev === next && prevProps.onSelect === nextProps.onSelect) {
        return true;
    }

    // 2. Check function prop stability
    if (prevProps.onSelect !== nextProps.onSelect) return false;

    // 3. Check primitive fields displayed in the card
    if (prev.id !== next.id) return false;
    if (prev.status !== next.status) return false;
    if (prev.title !== next.title) return false;
    if (prev.description !== next.description) return false;
    if (prev.startDate !== next.startDate) return false; // Assumes primitive string/number (not Date object)
    if (prev.durationDays !== next.durationDays) return false;

    // 4. Check posts length
    if ((prev.posts?.length || 0) !== (next.posts?.length || 0)) return false;

    // 5. Check completed posts count (determines progress bar)
    // Use reduce instead of filter to avoid array allocation
    const prevCompleted = (prev.posts || []).reduce((count, p) => p.status === CampaignStatus.DONE ? count + 1 : count, 0);
    const nextCompleted = (next.posts || []).reduce((count, p) => p.status === CampaignStatus.DONE ? count + 1 : count, 0);

    return prevCompleted === nextCompleted;
}

export default React.memo(CampaignCard, arePropsEqual);
