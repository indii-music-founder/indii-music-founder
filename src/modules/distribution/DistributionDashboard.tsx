import React, { useEffect } from 'react';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { ReleaseStatusCard } from './components/ReleaseStatusCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore } from '@/core/store';
import { ReleaseStatus } from '@/services/distribution/types/distributor';

export default function DistributionDashboard() {
    const { distribution, fetchReleases } = useStore();
    const { releases } = distribution;

    useEffect(() => {
        fetchReleases();
    }, []);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
            <div className="p-8 pb-0">
                <h1 className="text-4xl font-bold text-white mb-2">Distribution</h1>
                <p className="text-gray-400 mb-6">Manage your global release supply chain and track deliveries.</p>
            </div>

            <Tabs defaultValue="connections" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 border-b border-gray-800/50">
                    <TabsList className="bg-transparent gap-8 p-0 h-12">
                        <TabsTrigger
                            value="connections"
                            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-0 font-medium text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Distributors
                        </TabsTrigger>
                        <TabsTrigger
                            value="releases"
                            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-0 font-medium text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            Release Status
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    <TabsContent value="connections" className="mt-0 h-full p-0">
                        <DistributorConnectionsPanel />
                    </TabsContent>

                    <TabsContent value="releases" className="mt-0 p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Recent Deliveries</h2>
                            <p className="text-gray-400">Track the status of your releases across all connected platforms.</p>
                        </div>

                        {releases.length === 0 ? (
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
                                        status={Object.values(release.deployments)[0]?.status as ReleaseStatus || 'processing'}
                                        releaseDate={release.releaseDate || new Date().toISOString()}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
