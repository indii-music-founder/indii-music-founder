import React from 'react';
import { DollarSign } from 'lucide-react';
import { ExpenseTracker } from './components/ExpenseTracker';
import { MerchTable } from './components/MerchTable';

export default function FinanceDashboard() {
    return (
        <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-green-500/10 rounded-xl text-green-400">
                    <DollarSign size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Finance Department</h1>
                    <p className="text-gray-400">Track revenue and expenses</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-2">Revenue</h3>
                        <p className="text-gray-400 text-sm">$0.00 YTD</p>
                    </div>
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-2">Expenses</h3>
                        <p className="text-gray-400 text-sm">$0.00 YTD</p>
                    </div>
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <DollarSign size={64} className="text-teal-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">IndiiOS Dividend</h3>
                        <p className="text-teal-400 font-bold text-2xl">+$0.00</p>
                        <p className="text-gray-500 text-xs mt-1">Savings vs. Manager (20%)</p>
                    </div>
                </div>

                {/* Tools */}
                <ExpenseTracker />

                {/* Merch Table */}
                <MerchTable />
            </div>
        </div>
    );
}
