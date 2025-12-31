import React from 'react';
import { MerchandiseAnalytics } from './MerchandiseAnalytics';
import { MerchTable } from './MerchTable';

export const MerchandiseDashboard: React.FC = () => {
    return (
        <div className="flex flex-col space-y-6 pb-8">
            {/* Header Stats */}
            <div className="flex items-center justify-between p-6 bg-[#161b22] border border-gray-800 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[100px] pointer-events-none" />

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Merchandise Revenue</h2>
                    <p className="text-gray-400 text-sm">Real-time sales performance and inventory tracking</p>
                </div>
                <div className="text-right relative z-10">
                    <div className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">$12,450</div>
                    <div className="text-green-400 font-bold text-sm flex items-center justify-end gap-1 mt-1">
                        <span>↗ +15% Growth</span>
                        <span className="text-gray-500 font-normal ml-1">Last 30 Days</span>
                    </div>
                </div>
            </div>

            {/* Analytics Section */}
            <MerchandiseAnalytics />

            {/* Product List */}
            <div className="flex-1 min-h-0">
                <MerchTable isDashboardView={true} />
            </div>
        </div>
    );
};
