import React from 'react';
import { CampaignAsset } from '../types';
import CampaignCard from './CampaignCard';
import { Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// Fix for React 19 type mismatch
const PlusIcon = Plus as any;
const SparklesIcon = Sparkles as any;

interface CampaignListProps {
    campaigns: CampaignAsset[];
    onSelectCampaign: (campaign: CampaignAsset) => void;
    onCreateNew: () => void;
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

const CampaignList: React.FC<CampaignListProps> = ({ campaigns, onSelectCampaign, onCreateNew }) => {
    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        Active Campaigns <span className="text-sm font-normal text-gray-500 px-2 py-0.5 bg-gray-800 rounded-full border border-gray-700">{campaigns.length}</span>
                    </h2>
                    <p className="text-gray-400 mt-1">Manage and track your ongoing marketing efforts.</p>
                </div>
            </div>

            {/* Grid */}
            <motion.div
                variants={containerVars}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
                {/* Create New Card */}
                <motion.div variants={itemVars}>
                    <button
                        onClick={onCreateNew}
                        className="w-full h-full min-h-[220px] group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-dashed border-gray-700 bg-gray-900/20 hover:bg-gray-900/40 hover:border-purple-500/50 transition-all duration-300"
                    >
                        <div className="h-16 w-16 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300">
                            <PlusIcon size={32} className="text-gray-400 group-hover:text-purple-400" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">New Campaign</h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-[200px]">Launch a new AI-driven marketing campaign</p>
                        </div>

                        {/* Decorative AI Sparkles */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <SparklesIcon size={16} className="text-purple-400 animate-pulse" />
                        </div>
                    </button>
                </motion.div>

                {/* Campaign Cards */}
                {campaigns.map(campaign => (
                    <motion.div key={campaign.id} variants={itemVars}>
                        <CampaignCard
                            campaign={campaign}
                            onClick={() => onSelectCampaign(campaign)}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default CampaignList;
