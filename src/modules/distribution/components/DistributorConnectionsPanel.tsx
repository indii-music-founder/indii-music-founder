import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { DistributorCard } from './DistributorCard';
import ConnectDistributorModal from './ConnectDistributorModal';
import { DistributorService } from '@/services/distribution/DistributorService';
import type { IDistributorAdapter } from '@/services/distribution/types/distributor';

export const DistributorConnectionsPanel: React.FC = () => {
    const { distribution, fetchDistributors } = useStore();
    const { connections, loading, error } = distribution;

    const [selectedAdapter, setSelectedAdapter] = useState<IDistributorAdapter | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchDistributors();
    }, []);

    const handleConnect = (id: string) => {
        const adapter = DistributorService.getAdapter(id as import('@/services/distribution/types/distributor').DistributorId);
        if (adapter) {
            setSelectedAdapter(adapter);
            setIsModalOpen(true);
        } else {
            console.error(`Adapter not found for ${id}`);
        }
    };

    const handleModalSuccess = () => {
        setIsModalOpen(false);
        setSelectedAdapter(null);
        // Refresh connections to show the new status
        fetchDistributors();
    };

    if (loading && connections.length === 0) {
        return (
            <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 rounded-full border-t-2 border-white animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-[10px]">Scanning Connections</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-700">
            <div className="mb-12">
                <h2 className="text-3xl font-black tracking-tighter text-white mb-2 uppercase italic">Management Console</h2>
                <p className="text-gray-500 font-medium max-w-2xl">
                    Bridge your existing distribution accounts with IndiiOS. Real-time sync for metadata, deliveries, and high-fidelity reporting.
                </p>
            </div>

            {error && (
                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[12px] font-bold flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {connections.map((dist) => (
                    <DistributorCard
                        key={dist.distributorId}
                        connection={dist}
                        onConnect={handleConnect}
                        isConnecting={distribution.isConnecting && selectedAdapter?.id === dist.distributorId}
                    />
                ))}
            </div>

            {/* Recommendations Section */}
            <div className="mt-16 p-10 border border-gray-800/50 rounded-2xl bg-[#0F0F0F] relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h3 className="text-2xl font-black text-white mb-3 uppercase italic">Scale Up Your Reach</h3>
                        <p className="text-gray-500 mb-0 font-medium max-w-xl">
                            Looking for better metadata handling or higher royalty splits? IndiiOS power partners offer exclusive terms for our users.
                        </p>
                    </div>
                    <button className="px-8 py-3 bg-white text-black rounded-xl font-black text-[12px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5">
                        View Preferred Partners
                    </button>
                </div>

                {/* Background Decoration */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
            </div>

            {selectedAdapter && (
                <ConnectDistributorModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    adapter={selectedAdapter}
                    onSuccess={handleModalSuccess}
                />
            )}
        </div>
    );
};
