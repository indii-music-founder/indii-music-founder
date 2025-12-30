import React from 'react';
import { EarningsDashboard } from './components/EarningsDashboard';
import { ExpenseTracker } from './components/ExpenseTracker';
import { MerchandiseDashboard } from './components/MerchandiseDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FinanceDashboard() {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="p-8 pb-0">
                <h1 className="text-3xl font-bold text-white mb-2">Finance Department</h1>
                <p className="text-gray-400 mb-6">Track revenue, manage expenses, and analyze earnings.</p>
            </div>

            <Tabs defaultValue="earnings" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-8 border-b border-gray-800">
                    <TabsList>
                        <TabsTrigger value="earnings">Earnings & Royalties</TabsTrigger>
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="merch">Merchandise</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <TabsContent value="earnings" className="mt-0 h-full">
                        <EarningsDashboard />
                    </TabsContent>

                    <TabsContent value="expenses" className="mt-0">
                        <ExpenseTracker />
                    </TabsContent>

                    <TabsContent value="merch" className="mt-0">
                        <MerchandiseDashboard />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
