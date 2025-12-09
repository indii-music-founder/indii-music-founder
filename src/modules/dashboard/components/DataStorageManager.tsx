import { useStore } from '../../../core/store';
import React, { useEffect, useState } from 'react';
import { DashboardService, StorageStats } from '../../../services/dashboard/DashboardService';
import { HardDrive, Download, Trash2 } from 'lucide-react';

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

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <HardDrive className="text-purple-400" size={24} />
                <h2 className="text-lg font-bold text-white">Storage Health</h2>
            </div>

            {/* Meter */}
            {stats && (
                <div className="mb-8">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Used Space</span>
                        <span className="text-white font-mono">{formatBytes(stats.usedBytes)} / {formatBytes(stats.quotaBytes)}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-1000"
                            style={{ width: `${stats.percentUsed}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
                <button
                    onClick={() => DashboardService.exportBackup()}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-[#0d1117] border border-gray-700 hover:border-gray-500 rounded-lg text-gray-300 transition-all"
                >
                    <Download size={16} />
                    <span>Export Full Backup</span>
                </button>
                <button className="w-full flex items-center justify-center gap-2 p-3 bg-[#0d1117] border border-red-900/30 hover:border-red-500/50 rounded-lg text-red-400 transition-all">
                    <Trash2 size={16} />
                    <span>Clear Unused Cache</span>
                </button>
                <button
                    onClick={() => useStore.getState().setModule('knowledge')}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-[#0d1117] border border-blue-900/30 hover:border-blue-500/50 rounded-lg text-blue-400 transition-all"
                >
                    <HardDrive size={16} />
                    <span>Manage Knowledge Base</span>
                </button>
            </div>
        </div>
    );
}

