import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export function DistributorQuickView() {
    const { connections, loading } = useStore(
        useShallow((s) => ({
            connections: s.distribution.connections,
            loading: s.distribution.loading,
        }))
    );

    if (loading && connections.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Distributors</h3>
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="text-gray-600 animate-spin" />
                </div>
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Distributors</h3>
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                    <WifiOff size={14} className="text-gray-600 mx-auto mb-1.5" />
                    <p className="text-[10px] text-gray-600">No distributors connected</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Add one in the Distributors tab</p>
                </div>
            </div>
        );
    }

    // Show up to 5 connections in the sidebar widget
    const visible = connections.slice(0, 5);
    const connectedCount = connections.filter((d) => d.isConnected).length;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Distributors</h3>
                <span className="text-[10px] text-gray-600">{connectedCount}/{connections.length}</span>
            </div>
            <div className="space-y-1.5">
                {visible.map((d) => (
                    <div key={d.distributorId} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${d.isConnected ? 'bg-green-500/10' : 'bg-gray-800'}`}>
                            {d.isConnected
                                ? <Wifi size={11} className="text-green-400" />
                                : <WifiOff size={11} className="text-gray-600" />}
                        </div>
                        <span className="text-xs text-gray-300 flex-1 capitalize">{d.distributorId}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${d.isConnected ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`} />
                    </div>
                ))}
                {connections.length > 5 && (
                    <p className="text-[10px] text-gray-700 text-center pt-1">+{connections.length - 5} more</p>
                )}
            </div>
        </div>
    );
}
