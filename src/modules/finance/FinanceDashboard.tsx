import React from 'react';
import { EarningsDashboard } from './components/EarningsDashboard';
import { ExpenseTracker } from './components/ExpenseTracker';
import { MerchandiseDashboard } from './components/MerchandiseDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Briefcase, CreditCard, ShoppingBag, TrendingUp } from 'lucide-react';

export default function FinanceDashboard() {
    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
            {/* Header Area */}
            <div className="p-10 pb-6 relative">
                {/* Background Glow */}
                <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-teal-500/10 blur-[120px] pointer-events-none rounded-full" />
                <div className="absolute top-[-50px] right-[-50px] w-[300px] h-[300px] bg-purple-500/10 blur-[100px] pointer-events-none rounded-full" />

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <TrendingUp size={18} className="text-white" />
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter">Finance</h1>
                    </div>
                    <p className="text-gray-500 font-medium tracking-wide">REAL-TIME FISCAL OPERATIONS & PERFORMANCE ANALYTICS</p>
                </motion.div>
            </div>

            <Tabs defaultValue="earnings" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-10 border-b border-white/5">
                    <TabsList className="bg-transparent gap-8 p-0 h-14">
                        <TabsTrigger
                            value="earnings"
                            className="text-gray-500 data-[state=active]:text-white data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2"
                        >
                            <Briefcase size={16} />
                            Earnings & Royalties
                        </TabsTrigger>
                        <TabsTrigger
                            value="expenses"
                            className="text-gray-500 data-[state=active]:text-white data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2"
                        >
                            <CreditCard size={16} />
                            Expenses
                        </TabsTrigger>
                        <TabsTrigger
                            value="merch"
                            className="text-gray-500 data-[state=active]:text-white data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-teal-500 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2"
                        >
                            <ShoppingBag size={16} />
                            Merchandise
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto p-10">
                        <TabsContent value="earnings" className="mt-0 h-full outline-none">
                            <EarningsDashboard />
                        </TabsContent>

                        <TabsContent value="expenses" className="mt-0 outline-none">
                            <ExpenseTracker />
                        </TabsContent>

                        <TabsContent value="merch" className="mt-0 outline-none">
                            <MerchandiseDashboard />
                        </TabsContent>
                    </div>
                </div>
            </Tabs>
        </div>
    );
}
