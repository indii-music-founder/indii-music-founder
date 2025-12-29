import React, { useEffect } from 'react';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { ReleaseStatusCard } from './components/ReleaseStatusCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/core/store';
import { ReleaseStatus } from '@/services/distribution/types/distributor';

export default function DistributionDashboard() {
    const { distribution, subscribeToReleases } = useStore();
    const { releases, loading, error } = distribution;

    useEffect(() => {
        const unsubscribe = subscribeToReleases();
        return () => unsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-5xl font-black tracking-tighter uppercase italic">
                                Distribution
                            </h1>
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-green-500 tracking-widest uppercase">Live Sync</span>
                            </div>
                        </div>
                        <p className="text-gray-500 max-w-xl font-medium">
                            Automate your global rollout. Reach 150+ platforms with one-click delivery and real-time tracking.
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="releases" className="space-y-8">
                    <TabsList className="bg-[#121212] border border-gray-800/50 p-1 rounded-xl h-auto">
                        <TabsTrigger
                            value="releases"
                            className="px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black text-[13px] font-bold uppercase tracking-widest transition-all"
                        >
                            Active Releases
                        </TabsTrigger>
                        <TabsTrigger
                            value="connections"
                            className="px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black text-[13px] font-bold uppercase tracking-widest transition-all"
                        >
                            Distributors
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 w-full">
                        <TabsContent value="connections" className="mt-0 h-full p-0 border-none outline-none">
                            <DistributorConnectionsPanel />
                        </TabsContent>

                        <TabsContent value="releases" className="mt-0 border-none outline-none">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-white mb-2">Recent Deliveries</h2>
                                <p className="text-gray-400">Track the status of your releases across all connected platforms.</p>
                            </div>

                            {loading && releases.length === 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-64 rounded-2xl bg-gray-900/50 animate-pulse border border-gray-800" />
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="p-8 border border-red-900/50 rounded-2xl bg-red-900/10 text-center">
                                    <p className="text-red-400">{error}</p>
                                    <button
                                        onClick={() => subscribeToReleases()}
                                        className="mt-4 px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 rounded-lg transition-colors"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            ) : releases.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 border border-gray-800 rounded-2xl bg-gray-900/20 text-center">
                                    <div className="p-4 rounded-full bg-gray-800/50 mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-2">No active releases</h3>
                                    <p className="text-gray-400 max-w-sm">
                                        Your distributed music will appear here once you've started the rollout process from the Publishing Department.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {releases.map((release) => (
                                        <ReleaseStatusCard
                                            key={release.id}
                                            releaseTitle={release.title}
                                            artistName={release.artist}
                                            coverArtUrl={release.coverArtUrl}
                                            deployments={release.deployments}
                                            releaseDate={release.releaseDate || new Date().toISOString()}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
