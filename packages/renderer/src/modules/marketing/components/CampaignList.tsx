import React from 'react';
import { CampaignAsset } from '../types';
import CampaignCard from './CampaignCard';
import { Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { EmptyState } from '@/components/shared/EmptyState';

// Fix for React 19 type mismatch - using components directly

interface CampaignListProps {
    campaigns: CampaignAsset[];
    onSelectCampaign: (campaign: CampaignAsset) => void;
    onCreateNew: () => void;
    onAIGenerate?: () => void;
    searchQuery?: string;
    onClearSearch?: () => void;
}

const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const CampaignList: React.FC<CampaignListProps> = ({
    campaigns,
    onSelectCampaign,
    onCreateNew,
    onAIGenerate,
    searchQuery,
    onClearSearch,
}) => {
    const isSearchActive = Boolean(searchQuery && searchQuery.trim().length > 0);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">
            {/* Section Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                        {isSearchActive ? 'Search Results' : 'Active Campaigns'}{' '}
                        <span className="text-xs font-bold text-[#FFD700] px-2.5 py-0.5 bg-[#FFB800]/10 rounded-full border border-[#FFB800]/30 shadow-sm">{campaigns.length}</span>
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {isSearchActive ? `Campaigns matching "${searchQuery?.trim()}"` : 'Manage and track your ongoing marketing efforts.'}
                    </p>
                </div>
            </div>

            {/* Grid */}
            <motion.div
                variants={containerVars}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20"
            >
                {/* Autonomous Generate Card */}
                {onAIGenerate && !isSearchActive && (
                    <motion.div variants={itemVars}>
                        <button
                            onClick={onAIGenerate}
                            className="w-full h-full min-h-[240px] group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-dashed border-[#FFB800]/30 bg-[#14100C]/70 hover:bg-[#14100C] hover:border-[#FFB800]/60 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-[0_0_24px_rgba(255,184,0,0.15)]"
                        >
                            <div className="h-16 w-16 rounded-full bg-[#FFB800]/10 flex items-center justify-center group-hover:bg-[#FFB800]/20 group-hover:scale-110 transition-all duration-300">
                                <Sparkles size={30} className="text-[#FFD700] group-hover:text-white" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-sm font-bold text-white group-hover:text-[#FFD700] transition-colors tracking-tight">Generate with Intelligence</h3>
                                <p className="text-xs text-gray-400 mt-1 max-w-[160px]">Create a complete campaign from a brief</p>
                            </div>

                            {/* Decorative Sparkles */}
                            <div className="absolute top-4 right-4">
                                <Sparkles size={16} className="text-[#FFB800]/50 animate-pulse" />
                            </div>
                        </button>
                    </motion.div>
                )}

                {/* Create New Card */}
                {!isSearchActive && (
                    <motion.div variants={itemVars}>
                        <button
                            onClick={onCreateNew}
                            className="w-full h-full min-h-[240px] group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-dashed border-white/10 bg-[#14100C]/40 hover:bg-[#14100C]/80 hover:border-[#FFB800]/30 transition-all duration-300 backdrop-blur-md"
                        >
                            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#FFB800]/15 group-hover:scale-110 transition-all duration-300">
                                <Plus size={30} className="text-gray-400 group-hover:text-[#FFD700]" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors tracking-tight">New Campaign</h3>
                                <p className="text-xs text-gray-500 group-hover:text-gray-400 mt-1 max-w-[160px]">Create manually from scratch</p>
                            </div>

                            {/* Decorative Plus */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <Plus size={16} className="text-[#FFB800]" />
                            </div>
                        </button>
                    </motion.div>
                )}

                {/* Campaign Cards */}
                {campaigns.length === 0 ? (
                    <EmptyState
                        icon="search"
                        title={isSearchActive ? 'No campaigns found' : 'No active campaigns'}
                        description={isSearchActive
                            ? `No campaigns matched "${searchQuery?.trim()}". Try a different search term or clear the filter.`
                            : 'Create your first campaign to start reaching fans and tracking performance.'}
                        action={isSearchActive && onClearSearch
                            ? { label: 'Clear Search', onClick: onClearSearch }
                            : { label: 'Create Campaign', onClick: onCreateNew }}
                        secondaryAction={onAIGenerate && !isSearchActive ? { label: 'Generate with Intelligence', onClick: onAIGenerate, variant: 'secondary' } : undefined}
                        compact
                    />
                ) : campaigns.map(campaign => (
                    <motion.div key={campaign.id} variants={itemVars}>
                        <CampaignCard
                            campaign={campaign}
                            onSelect={onSelectCampaign}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

// Memoize the component to prevent re-renders when parent state changes but props remain the same
export default React.memo(CampaignList);
