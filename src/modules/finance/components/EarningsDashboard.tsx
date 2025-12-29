import React, { useEffect, useState } from 'react';
import { useFinance } from '../hooks/useFinance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueChart } from './RevenueChart';
import { EarningsTable } from './EarningsTable';
import type { EarningsSummary } from '@/services/ddex/types/dsr';

const OverviewTab = ({ data }: { data: EarningsSummary }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${data.totalNetRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Streams</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{data.totalStreams.toLocaleString()}</div>
            </CardContent>
        </Card>
    </div>
);

export const EarningsDashboard: React.FC = () => {
    // Custom hook
    const { earningsSummary, earningsLoading: loading, earningsError: error } = useFinance();

    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        // Initial fetch is handled by the hook for the default window
        // But if we wanted to be explicit or change date:
        // actions.loadEarnings('2024-01-01', '2024-01-31');
    }, []);

    if (loading) return <div className="p-8">Loading earnings data...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!earningsSummary) return <div className="p-8">No data available</div>;

    return (
        <div className="flex flex-col space-y-6 p-8 bg-background min-h-screen">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Earnings & Royalties</h2>
                <div className="flex items-center space-x-2">
                    {/* Date picker would go here */}
                    <span className="text-sm text-gray-500">Jan 2024</span>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="platforms">By Platform</TabsTrigger>
                    <TabsTrigger value="releases">By Release</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <OverviewTab data={earningsSummary} />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <RevenueChart
                            data={earningsSummary.byPlatform.map(p => ({
                                label: p.platformName,
                                value: p.revenue
                            }))}
                            title="Revenue by Platform"
                        />
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Top Territories</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {earningsSummary.byTerritory.map(t => (
                                        <div key={t.territoryCode} className="flex items-center">
                                            <div className="ml-4 space-y-1">
                                                <p className="text-sm font-medium leading-none">{t.territoryName}</p>
                                                <p className="text-sm text-muted-foreground">{t.territoryCode}</p>
                                            </div>
                                            <div className="ml-auto font-medium">+${t.revenue.toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="platforms">
                    <Card>
                        <CardHeader><CardTitle>Platform Breakdown</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {earningsSummary.byPlatform.map(p => (
                                    <div key={p.platformName} className="flex justify-between border-b py-2">
                                        <span>{p.platformName}</span>
                                        <span>${p.revenue.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="releases">
                    <EarningsTable data={earningsSummary.byRelease} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
