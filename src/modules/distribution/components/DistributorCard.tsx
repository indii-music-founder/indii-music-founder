import React from 'react';
import { Card } from '@/components/ui/card';
import type { DistributorConnection } from '@/services/distribution/types/distributor';

interface DistributorCardProps {
    connection: DistributorConnection;
    onConnect: (id: string) => void;
    isConnecting?: boolean;
}

const getDistributorColor = (id: string) => {
    const colors: Record<string, string> = {
        distrokid: 'from-[#4ade80] to-[#22c55e]',
        cdbaby: 'from-[#60a5fa] to-[#3b82f6]',
        tunecore: 'from-[#fbbf24] to-[#f59e0b]',
    };
    return colors[id] || 'from-gray-500 to-gray-600';
};

export const DistributorCard: React.FC<DistributorCardProps> = ({ connection, onConnect, isConnecting }) => {
    return (
        <Card className="group relative overflow-hidden bg-[#121212] border-gray-800/50 hover:border-gray-700/50 transition-all duration-300">
            {/* Top Gradient Banner */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${getDistributorColor(connection.distributorId)} transition-opacity duration-300 opacity-80 group-hover:opacity-100`} />

            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getDistributorColor(connection.distributorId)} flex items-center justify-center text-white shadow-lg shadow-black/20`}>
                            <span className="text-xl font-black italic">
                                {connection.distributorId.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white capitalize leading-none mb-1">
                                {connection.distributorId}
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${connection.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                                <span className={`text-[10px] font-bold tracking-tighter uppercase ${connection.isConnected ? 'text-green-500/80' : 'text-gray-500'}`}>
                                    {connection.isConnected ? 'Registered' : 'Disconnected'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="min-h-[40px]">
                        {connection.isConnected ? (
                            <div className="space-y-1">
                                <p className="text-[11px] text-gray-400 flex items-center justify-between">
                                    <span>Account</span>
                                    <span className="text-gray-300 font-medium truncate ml-2">{connection.accountEmail}</span>
                                </p>
                                <p className="text-[11px] text-gray-400 flex items-center justify-between">
                                    <span>Last Sync</span>
                                    <span className="text-gray-300 font-medium">{connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleDateString() : 'Never'}</span>
                                </p>
                            </div>
                        ) : (
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                Connect your {connection.distributorId} account to automate your distribution workflow.
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => !connection.isConnected && onConnect(connection.distributorId)}
                        disabled={connection.isConnected || isConnecting}
                        className={`w-full py-2.5 px-4 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${connection.isConnected
                            ? 'bg-gray-800/50 text-gray-500 cursor-default border border-gray-700/30'
                            : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5'
                            }`}
                    >
                        {connection.isConnected ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                                Verified
                            </>
                        ) : isConnecting ? (
                            'Establishing...'
                        ) : (
                            'Authorize'
                        )}
                    </button>

                    {connection.isConnected && (
                        <button className="w-full text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-center py-1">
                            Connection Settings
                        </button>
                    )}
                </div>
            </div>

            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </Card>
    );
};
