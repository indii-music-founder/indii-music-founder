import React, { useEffect } from 'react';
import { useStore } from '@/core/store';
import { DistributorCard } from './DistributorCard';

export const DistributorConnectionsPanel: React.FC = () => {
    // Zustand hook
    const { distribution, fetchDistributors, connectDistributor } = useStore();
    const { connections, loading, error } = distribution;

    useEffect(() => {
        fetchDistributors();
    }, []);

    const handleConnect = (id: string) => {
        // In a real app, this might open a detailed auth modal or OAuth flow
        // For now, we mock the connection action
        connectDistributor(id as any);
    };

    if (loading && connections.length === 0) return <div className="p-8">Loading distributors...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    return (
        <div className="p-8">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight mb-2">My Distributors</h2>
                <p className="text-muted-foreground">
                    Connect your existing distribution accounts to sync earnings and manage releases.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connections.map((dist) => (
                    <DistributorCard
                        key={dist.distributorId}
                        connection={dist}
                        onConnect={handleConnect}
                        isConnecting={loading} // Simple loading state for now
                    />
                ))}
            </div>

            {/* Add New Section */}
            <div className="mt-12 p-6 border rounded-lg bg-gray-50/50 dashed-border">
                <h3 className="text-lg font-semibold mb-2">Need a new distributor?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    IndiiOS recommends partners based on your genre and goals.
                </p>
                <button className="text-sm font-medium bg-secondary text-secondary-foreground px-4 py-2 rounded">
                    View Recommendations
                </button>
            </div>
        </div>
    );
};
