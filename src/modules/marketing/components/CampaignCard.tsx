import React from 'react';
import { CampaignAsset, CampaignStatus } from '../types';
import { Calendar, MoreHorizontal, ChevronRight, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// Fix for React 19 type mismatch with Lucide
const CalendarIcon = Calendar as React.FC<{ size?: number; className?: string }>;
const MoreHorizontalIcon = MoreHorizontal as React.FC<{ size?: number; className?: string }>;
const ChevronRightIcon = ChevronRight as React.FC<{ size?: number; className?: string }>;
const ActivityIcon = Activity as React.FC<{ size?: number; className?: string }>;

interface CampaignCardProps {
    campaign: CampaignAsset;
    onSelect: (campaign: CampaignAsset) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
    const isActive = campaign.status === CampaignStatus.EXECUTING;
    const isDone = campaign.status === CampaignStatus.DONE;

    // Calculate progress based on posts done vs total posts
    const completedPosts = campaign.posts.filter(p => p.status === CampaignStatus.DONE).length;
    const progress = Math.round((completedPosts / campaign.posts.length) * 100) || 0;

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
            className="group relative overflow-hidden rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md cursor-pointer transition-all duration-300 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-900/10 hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none"
        >
            {/* Background Gradient Mesh - Brand Accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="p-6 relative z-10 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {isActive && (
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                            <h3 className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors">
                                {campaign.title}
                            </h3>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-1">{campaign.description || "No description provided."}</p>
                    </div>
                    <button
                        className="text-gray-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5"
                        aria-label="More options"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <MoreHorizontalIcon size={18} />
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5 group-hover:border-purple-500/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <ActivityIcon size={12} className="text-purple-400" />
                            <span>Posts</span>
                        </div>
                        <span className="text-lg font-semibold text-gray-200">{campaign.posts.length}</span>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5 group-hover:border-pink-500/20 transition-colors">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <CalendarIcon size={12} className="text-pink-400" />
                            <span>Duration</span>
                        </div>
                        <span className="text-lg font-semibold text-gray-200">{campaign.durationDays}d</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Campaign Progress">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span className="text-gray-300 font-medium">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden" aria-hidden="true">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${isDone ? 'bg-emerald-500' :
                                isActive ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                                    'bg-gray-600'
                                }`}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-2 flex justify-between items-center border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`px-2 py-0.5 rounded-full border ${isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            isDone ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                'bg-gray-800 border-gray-700'
                            }`}>
                            {isActive ? 'Active' : isDone ? 'Completed' : 'Pending'}
                        </span>
                        <span>{campaign.startDate}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-purple-400 group-hover:translate-x-1 transition-transform">
                        Manage <ChevronRightIcon size={14} />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(CampaignCard);
