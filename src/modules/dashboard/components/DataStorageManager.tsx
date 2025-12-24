import { useStore } from '../../../core/store';
import React, { useEffect, useState } from 'react';
import { DashboardService, StorageStats } from '../../../services/dashboard/DashboardService';
import { HardDrive, Download, Trash2, Image, Video, Database } from 'lucide-react';

export default function DataStorageManager() {
    const [stats, setStats] = useState<StorageStats | null>(null);

    useEffect(() => {
        DashboardService.getStorageStats().then(setStats);
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Color based on usage percentage
    const getBarColor = (percent: number) => {
        if (percent >= 90) return 'from-red-600 to-red-500';
        if (percent >= 70) return 'from-yellow-600 to-orange-500';
        return 'from-purple-600 to-blue-500';
    };

    // Tier badge styles
    const getTierBadge = (tier?: string) => {
        switch (tier) {
            case 'enterprise':
                return 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black';
            case 'pro':
                return 'bg-gradient-to-r from-purple-500 to-blue-500 text-white';
            default:
                return 'bg-gray-700 text-gray-300';
        }
    };

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <HardDrive className="text-purple-400" size={24} />
                    <h2 className="text-lg font-bold text-white">Storage Health</h2>
                </div>
                {stats?.tier && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getTierBadge(stats.tier)}`}>
                        {stats.tier}
                    </span>
                )}
            </div>

            {/* Storage Meter */}
            {stats && (
                <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Used Space</span>
                        <span className="text-white font-mono">
                            {formatBytes(stats.usedBytes)} / {formatBytes(stats.quotaBytes)}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${getBarColor(stats.percentUsed)} transition-all duration-1000`}
                            style={{ width: `${Math.max(stats.percentUsed, 1)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{stats.percentUsed.toFixed(1)}% used</span>
                        <span>{formatBytes(stats.quotaBytes - stats.usedBytes)} free</span>
                    </div>
                </div>
            )}

            {/* Breakdown */}
            {stats?.breakdown && (
                <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="bg-[#0d1117] p-3 rounded-lg border border-gray-800 text-center">
                        <Image size={16} className="text-blue-400 mx-auto mb-1" />
                        <div className="text-xs text-gray-500">Images</div>
                        <div className="text-sm font-mono text-white">{formatBytes(stats.breakdown.images)}</div>
                    </div>
                    <div className="bg-[#0d1117] p-3 rounded-lg border border-gray-800 text-center">
                        <Video size={16} className="text-purple-400 mx-auto mb-1" />
                        <div className="text-xs text-gray-500">Videos</div>
                        <div className="text-sm font-mono text-white">{formatBytes(stats.breakdown.videos)}</div>
                    </div>
                    <div className="bg-[#0d1117] p-3 rounded-lg border border-gray-800 text-center">
                        <Database size={16} className="text-green-400 mx-auto mb-1" />
                        <div className="text-xs text-gray-500">Cache</div>
                        <div className="text-sm font-mono text-white">{formatBytes(stats.breakdown.knowledgeBase)}</div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
                <button
                    onClick={() => DashboardService.exportBackup()}
                    className="w-full flex items-center justify-center gap-2 p-3 min-h-11 bg-[#0d1117] border border-gray-700 hover:border-gray-500 rounded-lg text-gray-300 transition-all"
                >
                    <Download size={16} />
                    <span>Export Full Backup</span>
                </button>
                <button className="w-full flex items-center justify-center gap-2 p-3 min-h-11 bg-[#0d1117] border border-red-900/30 hover:border-red-500/50 rounded-lg text-red-400 transition-all">
                    <Trash2 size={16} />
                    <span>Clear Unused Cache</span>
                </button>
                <button
                    onClick={() => useStore.getState().setModule('knowledge')}
                    className="w-full flex items-center justify-center gap-2 p-3 min-h-11 bg-[#0d1117] border border-blue-900/30 hover:border-blue-500/50 rounded-lg text-blue-400 transition-all"
                >
                    <HardDrive size={16} />
                    <span>Manage Knowledge Base</span>
                </button>
            </div>
        </div>
    );
}
