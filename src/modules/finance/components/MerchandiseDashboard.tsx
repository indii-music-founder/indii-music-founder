import React from 'react';
import { MerchandiseAnalytics } from './MerchandiseAnalytics';
import { MerchTable } from './MerchTable';
import { motion } from 'framer-motion';
import { ShoppingBag, TrendingUp, Package, DollarSign } from 'lucide-react';

export const MerchandiseDashboard: React.FC = () => {
    return (
        <div className="flex flex-col space-y-8 pb-12">
            {/* Header Stats Component - Upgraded to V2 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative overflow-hidden p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl"
            >
                {/* Dynamic animated glow */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                    className="absolute -top-32 -right-32 w-96 h-96 bg-purple-600/20 blur-[100px] pointer-events-none rounded-full"
                />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                            <ShoppingBag size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                                Merchandise <span className="text-purple-500">Sales</span>
                            </h2>
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-widest mt-1">Global Commerce Operations</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
                        <div className="text-right">
                            <div className="text-xs text-gray-500 font-bold uppercase tracking-tighter mb-1">Total Net Revenue</div>
                            <div className="text-4xl font-black text-white leading-none">$12,450.00</div>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div className="bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                            <div className="text-emerald-400 font-bold text-sm flex items-center gap-1">
                                <TrendingUp size={14} />
                                <span>+15%</span>
                            </div>
                            <div className="text-[10px] text-emerald-500/60 font-bold uppercase mt-0.5">30D Growth</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Active Products</div>
                        <div className="text-xl font-bold text-white flex items-center gap-2">
                            <Package size={16} className="text-teal-500" />
                            24 Items
                        </div>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Stock Status</div>
                        <div className="text-xl font-bold text-white flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            Healthy
                        </div>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Pending Orders</div>
                        <div className="text-xl font-bold text-white">128 Shipments</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                        <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Average Margin</div>
                        <div className="text-xl font-bold text-teal-400">62.5%</div>
                    </div>
                </div>
            </motion.div>

            {/* Analytics Section - Wrapped in Glass */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 border border-white/5 rounded-[2rem] p-8"
            >
                <div className="flex items-center gap-2 mb-6 ml-1">
                    <TrendingUp size={16} className="text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Sales Performance Matrix</h3>
                </div>
                <MerchandiseAnalytics />
            </motion.div>

            {/* Product List */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex-1 min-h-0 bg-black/20 border border-white/5 rounded-[2rem] overflow-hidden shadow-xl"
            >
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Full Inventory Ledger</h3>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all border border-white/10"
                    >
                        Export CSV
                    </motion.button>
                </div>
                <div className="p-4">
                    <MerchTable isDashboardView={true} />
                </div>
            </motion.div>
        </div>
    );
};
