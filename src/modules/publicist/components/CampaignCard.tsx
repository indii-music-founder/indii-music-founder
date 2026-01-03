import React from 'react';
import { motion } from 'framer-motion';
import { Disc, Calendar, BarChart2, Radio, Send } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignCardProps {
    campaign: Campaign;
    onClick?: (campaign: Campaign) => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
    return (
        <motion.div
            layout
            onClick={() => onClick?.(campaign)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="group relative glass hover:bg-black/60 transition-all duration-300 hover:border-dept-campaign/30 overflow-hidden p-5 rounded-2xl cursor-pointer"
        >
            {/* Status Badge */}
            <div className="absolute top-4 right-4 z-10">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md ${campaign.status === 'Live' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                    campaign.status === 'Scheduled' ? 'bg-dept-distribution/10 border-dept-distribution/20 text-dept-distribution' :
                        'bg-muted/10 border-border text-muted-foreground'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'Live' ? 'bg-green-400 animate-pulse' :
                        campaign.status === 'Scheduled' ? 'bg-dept-distribution' :
                            'bg-muted-foreground'
                        }`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{campaign.status}</span>
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                {/* Visual */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-2xl bg-black">
                    {campaign.coverUrl ? (
                        <img src={campaign.coverUrl} alt={campaign.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800">
                            <Disc className="text-gray-600" size={24} />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* Header */}
                <div>
                    <h3 className="text-lg font-bold text-foreground group-hover:text-dept-campaign transition-colors leading-tight mb-1">
                        {campaign.title}
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                        {campaign.artist}
                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                        <span className="text-muted-foreground uppercase text-[10px] tracking-widest">{campaign.type}</span>
                    </p>
                </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Campaign Progress</span>
                        <span className="text-foreground font-bold">{campaign.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${campaign.progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-dept-campaign to-dept-marketing"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Release</span>
                        </div>
                        <span className="text-xs text-foreground font-medium">{campaign.releaseDate}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Send size={12} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Open Rate</span>
                        </div>
                        <span className="text-xs text-foreground font-medium">{campaign.openRate}%</span>
                    </div>
                </div>
            </div>

            {/* Decorative Glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-dept-campaign/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.div>
    );
}
