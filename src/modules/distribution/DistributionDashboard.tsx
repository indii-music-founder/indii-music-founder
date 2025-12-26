import React from 'react';
import { DistributorConnectionsPanel } from './components/DistributorConnectionsPanel';
import { ReleaseStatusCard } from './components/ReleaseStatusCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DistributionDashboard() {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-8 pb-0">
                <h1 className="text-3xl font-bold text-white mb-2">Distribution</h1>
                <p className="text-gray-400 mb-6">Manage your global release supply chain.</p>
            </div>

            <Tabs defaultValue="connections" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 border-b border-gray-800">
                    <TabsList>
                        <TabsTrigger value="connections">Distributors</TabsTrigger>
                        <TabsTrigger value="releases">Release Status</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    <TabsContent value="connections" className="mt-0 h-full p-0">
                        <DistributorConnectionsPanel />
                    </TabsContent>

                    <TabsContent value="releases" className="mt-0 p-8">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-white">Recent Deliveries</h2>
                        </div>
                        {/* Mock data for ReleaseStatusCard demonstration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <ReleaseStatusCard
                                releaseTitle="Neon Dreams"
                                artistName="The Synthetics"
                                status="live"
                                releaseDate={new Date().toISOString()}
                                upc="123456789012"
                            />
                            <ReleaseStatusCard
                                releaseTitle="Midnight City"
                                artistName="Lofi Beats"
                                status="processing"
                                releaseDate={new Date().toISOString()}
                            />
                            <ReleaseStatusCard
                                releaseTitle="Acoustic Sessions"
                                artistName="Jane Doe"
                                status="failed"
                                releaseDate={new Date().toISOString()}
                            />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
