import React from 'react';
import { Globe, MailOpen, DollarSign } from 'lucide-react';

interface StatsTickerProps {
    stats: {
        globalReach: string;
        avgOpenRate: string;
        placementValue: string;
    }
}

export function StatsTicker({ stats }: StatsTickerProps) {
    return (
        <div className="flex items-center gap-6 px-4 py-2 bg-gradient-to-r from-sonic-purple/10 to-sonic-blue/10 border border-sonic-purple/10 rounded-full backdrop-blur-md">
            <div className="flex items-center gap-2 border-r border-white/5 pr-6">
                <Globe size={14} className="text-sonic-blue" />
                <span className="text-xs text-muted-foreground font-medium">Global Reach:</span>
                <span className="text-sm font-bold text-foreground">{stats.globalReach}</span>
            </div>
            <div className="flex items-center gap-2 border-r border-white/5 pr-6">
                <MailOpen size={14} className="text-green-400" />
                <span className="text-xs text-muted-foreground font-medium">Open Rate:</span>
                <span className="text-sm font-bold text-foreground">{stats.avgOpenRate}</span>
            </div>
            <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-sonic-purple" />
                <span className="text-xs text-muted-foreground font-medium">Media Value:</span>
                <span className="text-sm font-bold text-foreground">{stats.placementValue}</span>
            </div>
        </div>
    );
}
