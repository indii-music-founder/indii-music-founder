import React, { useEffect } from 'react';
import { useStore } from '@/core/store';
import { DistributorCard } from './DistributorCard';

export const DistributorConnectionsPanel: React.FC = () => {
    const { distribution, fetchDistributors, connectDistributor } = useStore();
    const { connections, loading, error } = distribution;

    useEffect(() => {
        fetchDistributors();
    }, []);

    const handleConnect = (id: string) => {
        connectDistributor(id as any);
    };

    if (loading && connections.length === 0) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    <p className="text-gray-400">Loading distributors...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white mb-2">My Distributors</h2>
                <p className="text-gray-400">
                    Connect your existing distribution accounts to sync earnings and manage releases.
                </p>
            </div>

            {error && (
                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {connections.map((dist) => (
                    <DistributorCard
                        key={dist.distributorId}
                        connection={dist}
                        onConnect={handleConnect}
                        isConnecting={loading}
                    />
                ))}
            </div>

            {/* Recommendations Section */}
            <div className="mt-12 p-8 border border-gray-800 rounded-xl bg-gray-900/50 border-dashed">
                <h3 className="text-xl font-semibold text-white mb-2">Need a new distributor?</h3>
                <p className="text-gray-400 mb-6 max-w-2xl">
                    IndiiOS recommends partners based on your genre, budget, and career goals. Get discounted rates with our preferred partners.
                </p>
                <button className="px-6 py-2.5 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                    View Recommendations
                </button>
            </div>
        </div>
    );
};
