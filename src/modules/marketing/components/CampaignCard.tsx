import React from 'react';
import { CampaignAsset, CampaignStatus } from '../types';
import { Calendar, MoreHorizontal, ChevronRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// Fix for React 19 type mismatch with Lucide
const CalendarIcon = Calendar as any;
const MoreHorizontalIcon = MoreHorizontal as any;
const ChevronRightIcon = ChevronRight as any;
const ActivityIcon = Activity as any;

interface CampaignCardProps {
    campaign: CampaignAsset;
    onSelect: (campaign: CampaignAsset) => void;
}

/**
 * CampaignCard Component
 *
 * ⚡ Bolt UI Update:
 * Unified to use Department Tokens (Marketing + Campaign) instead of hardcoded hex/Tailwind colors.
 * - Marketing (Magenta): Primary Identity
 * - Campaign (Coral): Secondary Accent
 */
const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
    const isActive = campaign.status === CampaignStatus.EXECUTING;
    const isDone = campaign.status === CampaignStatus.DONE;

    // Calculate progress based on posts done vs total posts
    const completedPosts = campaign.posts.filter(p => p.status === CampaignStatus.DONE).length;
    const progress = Math.round((completedPosts / campaign.posts.length) * 100) || 0;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Prevent activation if the event originated from a child interactive element (like the More Options button)
        // This stops bubbling events from triggering the card selection
        if (e.target !== e.currentTarget) {
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(campaign);
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(campaign)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`Select campaign: ${campaign.title}`}
            // Bolt UI Unification: Using dept-marketing for visual hierarchy and removing hardcoded hexes
            // Added focus-visible styles for accessibility
            className="group relative overflow-hidden rounded-2xl bg-surface/40 border border-border/50 backdrop-blur-md cursor-pointer transition-all duration-300 hover:border-dept-marketing/30 hover:shadow-2xl hover:shadow-dept-marketing/10 hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dept-marketing focus-visible:outline-none"
        >
            {/* Background Gradient Mesh - Marketing Primary to Campaign Secondary */}
            <div className="absolute inset-0 bg-gradient-to-br from-dept-marketing/5 via-transparent to-dept-campaign/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="p-6 relative z-10 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {isActive && (
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-dept-marketing opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-dept-marketing"></span>
                                </span>
                            )}
                            <h3 className="text-lg font-bold text-foreground group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-dept-marketing group-hover:to-dept-campaign transition-colors">
                                {campaign.title}
                            </h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{campaign.description || "No description provided."}</p>
                    </div>
                    <button
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-dept-marketing focus-visible:outline-none"
                        aria-label="More options"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        onKeyDown={(e) => {
                            // Stop propagation of key events to prevent triggering the card's handler
                            e.stopPropagation();
                        }}
                    >
                        <MoreHorizontalIcon size={18} />
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="bg-black/20 rounded-xl p-3 border border-border/10 group-hover:border-dept-marketing/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            {/* Marketing Activity */}
                            <ActivityIcon size={12} className="text-dept-marketing" />
                            <span>Posts</span>
                        </div>
                        <span className="text-lg font-semibold text-foreground">{campaign.posts.length}</span>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3 border border-border/10 group-hover:border-dept-campaign/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            {/* Campaign Duration */}
                            <CalendarIcon size={12} className="text-dept-campaign" />
                            <span>Duration</span>
                        </div>
                        <span className="text-lg font-semibold text-foreground">{campaign.durationDays}d</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="text-foreground font-medium">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isDone ? 'bg-success' :
                                isActive ? 'bg-gradient-to-r from-dept-marketing to-dept-campaign' :
                                    'bg-muted-foreground'
                                }`}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-2 flex justify-between items-center border-t border-border/10">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full border ${isActive ? 'bg-dept-marketing/10 border-dept-marketing/20 text-dept-marketing' :
                            isDone ? 'bg-success/10 border-success/20 text-success' :
                                'bg-secondary border-border'
                            }`}>
                            {isActive ? 'Active' : isDone ? 'Completed' : 'Pending'}
                        </span>
                        <span>{campaign.startDate}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-dept-marketing group-hover:translate-x-1 transition-transform">
                        Manage <ChevronRightIcon size={14} />
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default React.memo(CampaignCard);
