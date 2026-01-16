import React, { useState } from 'react';
import { CampaignAsset, CampaignStatus, ScheduledPost } from '../types';
import { ArrowLeft, Calendar, LayoutGrid, List, Play, CheckCircle, AlertCircle, Clock, MoreVertical, Edit3, Image as ImageIcon, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import AIPredictionPanel from './AIPredictionPanel';

import { LucideIcon } from 'lucide-react';

const ArrowLeftIcon = ArrowLeft as LucideIcon;
const CalendarIcon = Calendar as LucideIcon;
const LayoutGridIcon = LayoutGrid as LucideIcon;
const ListIcon = List as LucideIcon;
const PlayIcon = Play as LucideIcon;
const CheckCircleIcon = CheckCircle as LucideIcon;
const AlertCircleIcon = AlertCircle as LucideIcon;
const ClockIcon = Clock as LucideIcon;
const MoreVerticalIcon = MoreVertical as LucideIcon;
const Edit3Icon = Edit3 as LucideIcon;
const ImageIconComponent = ImageIcon as LucideIcon;
const SparklesIcon = Sparkles as LucideIcon;

interface CampaignDetailProps {
    campaign: CampaignAsset;
    onBack: () => void;
    onExecute: () => void;
    isExecuting: boolean;
    onEditPost: (post: ScheduledPost) => void;
    onGenerateImages?: () => void;
}

const CampaignDetail: React.FC<CampaignDetailProps> = ({ campaign, onBack, onExecute, isExecuting, onEditPost, onGenerateImages }) => {
    const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
    const postsWithoutImages = campaign.posts.filter(p => !p.imageAsset.imageUrl).length;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-6 pb-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                        <ArrowLeftIcon size={20} />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-white">{campaign.title}</h1>
                            <span
                                data-testid="campaign-status-badge"
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${campaign.status === CampaignStatus.EXECUTING ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                campaign.status === CampaignStatus.DONE ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                    'bg-gray-800 border-gray-700 text-gray-400'
                                }`}>
                                {campaign.status}
                            </span>
                        </div>
                        <p className="text-gray-400 mt-1">{campaign.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
                            <button
                                onClick={() => setViewMode('timeline')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'timeline' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <ListIcon size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <LayoutGridIcon size={18} />
                            </button>
                        </div>

                        {/* AI Generate Images Button */}
                        {onGenerateImages && postsWithoutImages > 0 && (
                            <button
                                onClick={onGenerateImages}
                                className="flex items-center gap-2 px-4 py-2.5 font-semibold rounded-xl transition-all bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                            >
                                <SparklesIcon size={16} />
                                <span className="hidden sm:inline">Generate</span> {postsWithoutImages} Images
                            </button>
                        )}

                        <button
                            onClick={onExecute}
                            disabled={isExecuting || campaign.status === CampaignStatus.DONE}
                            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20 ${isExecuting ? 'bg-purple-900/50 text-purple-200 cursor-wait' :
                                campaign.status === CampaignStatus.DONE ? 'bg-gray-800 text-gray-400 cursor-not-allowed' :
                                    'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                                }`}
                        >
                            {isExecuting ? (
                                <>Processing...</>
                            ) : (
                                <><PlayIcon size={18} className="fill-current" /> Execute Campaign</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard label="Total Posts" value={campaign.posts.length} icon={<ImageIconComponent size={16} className="text-blue-400" />} />
                    <StatCard label="Duration" value={`${campaign.durationDays} Days`} icon={<ClockIcon size={16} className="text-purple-400" />} />
                    <StatCard label="Platform Reach" value="24.5K" subtext="+12% vs avg" icon={<CalendarIcon size={16} className="text-pink-400" />} />
                    <StatCard label="Engagement" value="4.2%" subtext="High Impact" icon={<CheckCircleIcon size={16} className="text-green-400" />} />
                </div>
            </div>

            {/* Content View */}
            <div className="flex-1 min-h-0 overflow-hidden flex gap-6">
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode='wait'>
                        {viewMode === 'timeline' ? (
                            <TimelineView posts={campaign.posts} onEdit={onEditPost} key="timeline" />
                        ) : (
                            <GridView posts={campaign.posts} onEdit={onEditPost} key="grid" />
                        )}
                    </AnimatePresence>
                </div>

                {/* AI Prediction Panel - Sidebar */}
                <div className="w-80 flex-shrink-0 overflow-y-auto hidden xl:block">
                    <AIPredictionPanel campaign={campaign} />
                </div>
            </div>
        </div>
    );
};

interface StatCardProps {
    label: string;
    value: string | number;
    subtext?: string;
    icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, icon }) => (
    <div className="bg-gray-900/40 backdrop-blur-sm border border-white/5 rounded-xl p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium uppercase tracking-wider">
            {icon} {label}
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subtext && <div className="text-xs text-green-400 font-medium">{subtext}</div>}
    </div>
);

const TimelineView = ({ posts, onEdit }: { posts: ScheduledPost[], onEdit: (p: ScheduledPost) => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="h-full overflow-y-auto pr-2 space-y-4 custom-scrollbar"
    >
        {posts.map((post, index) => (
            <div key={post.id || index} className="group flex gap-6 relative">
                {/* Timeline Line */}
                <div className="absolute left-[27px] top-10 bottom-0 w-0.5 bg-gray-800 last:hidden"></div>

                {/* Day Indicator */}
                <div className="flex flex-col items-center gap-2 pt-1 flex-shrink-0 w-14">
                    <div className="h-14 w-14 rounded-full bg-gray-900 border border-gray-700 flex flex-col items-center justify-center z-10">
                        <span className="text-xs text-gray-500 uppercase font-bold">Day</span>
                        <span className="text-lg font-bold text-white">{post.day}</span>
                    </div>
                </div>

                {/* Content Card */}
                <div className="flex-1 bg-gray-900/30 border border-white/5 rounded-2xl p-5 hover:bg-gray-900/50 hover:border-gray-700 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${post.platform === 'Twitter' ? 'bg-sky-500/10 text-sky-400' :
                                post.platform === 'Instagram' ? 'bg-pink-500/10 text-pink-500' :
                                    'bg-blue-600/10 text-blue-400'
                                }`}>
                                {post.platform}
                            </span>
                            <StatusBadge status={post.status} />
                        </div>
                        <button onClick={() => onEdit(post)} aria-label="Edit post" className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <Edit3Icon size={16} />
                        </button>
                    </div>

                    <div className="flex gap-5">
                        {post.imageAsset.imageUrl && (
                            <div className="relative group/image overflow-hidden rounded-xl w-32 h-32 flex-shrink-0 border border-gray-800">
                                <img src={post.imageAsset.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                                    <ImageIconComponent size={20} className="text-white" />
                                </div>
                            </div>
                        )}
                        <div className="flex-1 space-y-3">
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-black/20 p-3 rounded-lg border border-white/5">
                                {post.copy}
                            </p>
                            {post.imageAsset.title && (
                                <p className="text-xs text-gray-500 italic">Asset: {post.imageAsset.title}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </motion.div>
);

const GridView = ({ posts, onEdit }: { posts: ScheduledPost[], onEdit: (p: ScheduledPost) => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar"
    >
        {posts.map((post) => (
            <div key={post.id} className="group bg-gray-900/30 border border-white/5 rounded-2xl p-4 hover:border-gray-700 transition-all hover:shadow-xl hover:shadow-black/50 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-semibold text-gray-400">Day {post.day}</span>
                    <button onClick={() => onEdit(post)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
                        <MoreVerticalIcon size={16} />
                    </button>
                </div>

                {post.imageAsset.imageUrl ? (
                    <div className="aspect-square w-full bg-gray-900 rounded-xl mb-3 overflow-hidden relative">
                        <img src={post.imageAsset.imageUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                            <StatusBadge status={post.status} compact />
                        </div>
                    </div>
                ) : (
                    <div className="aspect-square w-full bg-gray-800/50 rounded-xl mb-3 flex items-center justify-center text-gray-600 border border-gray-800 border-dashed">
                        <ImageIconComponent size={32} />
                    </div>
                )}

                <div className="mt-auto">
                    <div className={`text-xs font-bold mb-1 ${post.platform === 'Twitter' ? 'text-sky-400' : 'text-pink-500'
                        }`}>
                        {post.platform}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{post.copy}</p>
                </div>
            </div>
        ))}
    </motion.div>
);

const StatusBadge = ({ status, compact = false }: { status: CampaignStatus, compact?: boolean }) => {
    const styles = {
        [CampaignStatus.PENDING]: 'text-gray-400 bg-gray-800/50 border-gray-700',
        [CampaignStatus.EXECUTING]: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
        [CampaignStatus.DONE]: 'text-green-400 bg-green-500/10 border-green-500/20',
        [CampaignStatus.FAILED]: 'text-red-400 bg-red-500/10 border-red-500/20',
    };

    const icons = {
        [CampaignStatus.PENDING]: ClockIcon,
        [CampaignStatus.EXECUTING]: ClockIcon, // Or loader
        [CampaignStatus.DONE]: CheckCircleIcon,
        [CampaignStatus.FAILED]: AlertCircleIcon,
    };

    const Icon = icons[status];

    if (compact) {
        return (
            <div className={`p-1.5 rounded-md border backdrop-blur-md ${styles[status]}`}>
                <Icon size={12} />
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
            <Icon size={12} />
            <span>{status.charAt(0) + status.slice(1).toLowerCase()}</span>
        </div>
    );
};

export default CampaignDetail;
