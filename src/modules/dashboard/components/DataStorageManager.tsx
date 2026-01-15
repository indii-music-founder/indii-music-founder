import { useState, useEffect } from 'react';
import { Database, Download, ExternalLink, HardDrive, Trash2 } from 'lucide-react';
import { DashboardService, StorageStats } from '@/services/dashboard/DashboardService';
import { AnimatedNumber } from '@/components/motion-primitives/animated-number';
import { useStore } from '@/core/store';

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

    const getBarColor = (percent: number) => {
        if (percent > 90) return 'from-red-500 to-orange-500';
        if (percent > 70) return 'from-orange-500 to-yellow-500';
        return 'from-blue-500 to-indigo-500';
    };

    return (
        <div className="bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-6 h-full flex flex-col relative overflow-hidden group">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <HardDrive size={120} />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <Database className="text-blue-400" size={24} />
                <h2 className="text-lg font-bold text-white">Storage Health</h2>
            </div>

            {stats && (
                <div className="mb-6 relative z-10">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400 font-medium">Used Space</span>
                        <span className="text-white font-mono">
                            {formatBytes(stats.usedBytes)} <span className="text-gray-600 mx-1">/</span> {formatBytes(stats.quotaBytes)}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-white/5">
                        <div
                            className={`h-full bg-gradient-to-r ${getBarColor(stats.percentUsed)} transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
                            style={{ width: `${Math.max(stats.percentUsed, 1)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-2">
                        <span className="text-blue-400">
                            <AnimatedNumber value={stats.percentUsed} precision={1} />% used
                        </span>
                        <span className="text-gray-500 lowercase">
                            {formatBytes(stats.quotaBytes - stats.usedBytes)} free
                        </span>
                    </div>
                </div>
            )}

            {/* Breakdown */}
            <div className="space-y-3 mb-6 flex-1 relative z-10">
                {stats?.breakdown ? [
                    { label: 'Images', bytes: stats.breakdown.images, color: 'bg-blue-500' },
                    { label: 'Videos', bytes: stats.breakdown.videos, color: 'bg-green-500' },
                    { label: 'Cloud Drive', bytes: stats.breakdown.knowledgeBase, color: 'bg-purple-500' }
                ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-bg-dark/50 rounded-lg border border-gray-800/50 hover:border-gray-700 transition-colors">
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                            <span className="text-gray-400">{item.label}</span>
                        </div>
                        <span className="text-gray-300 font-mono">{formatBytes(item.bytes)}</span>
                    </div>
                )) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 relative z-10">
                <button
                    onClick={() => DashboardService.exportBackup()}
                    className="flex items-center justify-center gap-2 bg-bg-dark hover:bg-gray-800 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-all border border-gray-800 min-h-11 active:scale-95"
                >
                    <Download size={14} /> Backup
                </button>
                <button
                    onClick={() => useStore.getState().setModule('knowledge')}
                    className="flex items-center justify-center gap-2 bg-bg-dark hover:bg-gray-800 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-all border border-gray-800 min-h-11 active:scale-95"
                >
                    <ExternalLink size={14} /> Knowledge
                </button>
            </div>
        </div>
    );
}

