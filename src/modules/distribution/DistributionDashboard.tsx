
import React, { useState, useEffect } from 'react';
import { DistributorService } from '@/services/distribution/DistributorService';
import { IDistributorAdapter } from '@/services/distribution/types/distributor';
import DistributorCard from './components/DistributorCard';
import ConnectDistributorModal from './components/ConnectDistributorModal';
import ReleaseStatusList from './components/ReleaseStatusList';
import { LayoutGrid, List, Globe, RefreshCw } from 'lucide-react';

export default function DistributionDashboard() {
    const [adapters, setAdapters] = useState<IDistributorAdapter[]>([]);
    const [connections, setConnections] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdapter, setSelectedAdapter] = useState<IDistributorAdapter | undefined>(undefined);

    // Release Data
    const [releases, setReleases] = useState<any[]>([]);

    useEffect(() => {
        loadDistributors();
    }, []);

    const loadDistributors = async () => {
        setLoading(true);
        try {
            // 1. Get all registered adapters
            // Note: In a real app we might need a method to getAllAdapters(), 
            // but for now we can get IDs and iterate.
            const ids = DistributorService.getRegisteredDistributors();
            const loadedAdapters = ids.map(id => DistributorService.getAdapter(id)).filter((a): a is IDistributorAdapter => !!a);
            setAdapters(loadedAdapters);

            // 2. Check connection status for each
            const connStatuses = await DistributorService.getConnectionStatus();
            const connMap: Record<string, boolean> = {};
            connStatuses.forEach(c => {
                connMap[c.distributorId] = c.isConnected;
            });
            setConnections(connMap);

            // 3. Load Releases
            const loadedReleases = DistributorService.getAllReleases();
            setReleases(loadedReleases);

        } catch (e) {
            console.error("Failed to load distribution data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectClick = (adapterId: string) => {
        const adapter = adapters.find(a => a.id === adapterId);
        if (adapter) {
            setSelectedAdapter(adapter);
            setIsModalOpen(true);
        }
    };

    const handleConnectSuccess = async () => {
        // Refresh statuses
        await loadDistributors();
    };

    return (
        <div className="h-full flex flex-col space-y-8 p-8 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Distribution</h1>
                    <p className="text-gray-400 mt-2 text-lg">Manage your global release supply chain.</p>
                </div>
                <button
                    onClick={loadDistributors}
                    className="p-2.5 bg-[#161b22] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                    title="Refresh Status"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-0">
                        <Globe size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{Object.values(connections).filter(Boolean).length}</div>
                        <div className="text-sm text-gray-400">Active Connections</div>
                    </div>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-0">
                        <List size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{releases.length}</div>
                        <div className="text-sm text-gray-400">Total Releases</div>
                    </div>
                </div>
                {/* Placeholder for Revenue or other stat */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 mb-0">
                        <LayoutGrid size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">98%</div>
                        <div className="text-sm text-gray-400">Delivery Success</div>
                    </div>
                </div>
            </div>

            {/* Distributors Grid */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Globe size={20} className="text-blue-400" />
                    Aggregators & Distributors
                </h2>
                {adapters.length === 0 && !loading ? (
                    <div className="p-8 text-center text-gray-500 border border-gray-800 rounded-xl border-dashed">
                        No distributors configured in the system.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {adapters.map(adapter => (
                            <DistributorCard
                                key={adapter.id}
                                adapter={adapter}
                                isConnected={connections[adapter.id] || false}
                                onConnect={handleConnectClick}
                                onManage={(id) => console.log('Manage', id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Releases List */}
            <div className="space-y-4 pb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <List size={20} className="text-purple-400" />
                    Recent Distributions
                </h2>
                <ReleaseStatusList
                    releases={releases}
                    onDeliver={(rel, dist) => console.log('Deliver', rel, dist)}
                    onViewReport={(rel) => console.log('Report', rel)}
                />
            </div>

            {/* Modals */}
            <ConnectDistributorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                adapter={selectedAdapter}
                onSuccess={handleConnectSuccess}
            />
        </div>
    );
}
