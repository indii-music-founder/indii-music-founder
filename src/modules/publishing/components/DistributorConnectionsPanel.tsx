import React from 'react';
import { useDistributorConnections } from '../hooks/useDistributorConnections';
import { Globe, Loader2, AlertCircle, ExternalLink, Plus } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

export const DistributorConnectionsPanel: React.FC = () => {
    const { connections, loading, refresh, disconnect } = useDistributorConnections();
    const { setModule } = useStore(useShallow(state => ({
        setModule: state.setModule
    })));

    return (
        <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between tracking-tight">
                Distribution
                <Globe size={16} className="text-gray-600" />
            </h3>

            <div className="flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-6 h-full">
                        <Loader2 size={24} className="text-blue-500 animate-spin" />
                    </div>
                ) : connections.length === 0 ? (
                    <div className="text-center py-8 bg-gray-900/30 rounded-xl border border-dashed border-gray-800 h-full flex flex-col justify-center">
                        <AlertCircle size={24} className="text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm font-medium">No connectors active</p>
                        <button
                            onClick={() => setModule('distribution')}
                            className="text-xs text-blue-500 font-bold mt-2 hover:underline"
                        >
                            Connect Now
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {connections.map((conn) => (
                            <div key={conn.distributorId} className="flex items-center justify-between p-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl border border-gray-800/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${conn.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-gray-600'}`} />
                                    <span className={`text-sm font-medium ${conn.isConnected ? "text-gray-300" : "text-gray-600"}`}>
                                        {conn.distributorId.charAt(0).toUpperCase() + conn.distributorId.slice(1)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{conn.isConnected ? 'Synced' : 'Inactive'}</span>
                                    <ExternalLink size={14} className="text-gray-700 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={() => setModule('distribution')}
                            className="w-full py-2 border border-dashed border-gray-800 rounded-xl text-gray-600 hover:text-white hover:border-gray-600 hover:bg-gray-900/50 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider"
                        >
                            <Plus size={12} /> Add Platform
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setModule('distribution')}
                className="w-full mt-6 px-4 py-3 bg-[#161616] text-white border border-gray-800 rounded-xl hover:bg-gray-800 transition-all text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
            >
                Manage Connections
            </button>

            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none -mr-10 -mt-10" />
        </div>
    );
};

