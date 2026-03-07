import React from 'react';
import { Package, Truck, Store, AlertCircle } from 'lucide-react';

interface InventoryDashboardProps {
    className?: string;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ className }) => {
    // Native Inventory Tracking UI mock (Item 123)
    const inventoryStats = [
        { label: 'Physical Merch', value: 1245, trend: '+12%', icon: Package },
        { label: 'Virtual Collectibles', value: 850, trend: '+5%', icon: Store },
        { label: 'Pending Fulfillment', value: 34, trend: '-2%', icon: Truck }
    ];

    return (
        <div className={`p-6 bg-[#0f0f0f] text-gray-200 rounded-xl border border-gray-800 ${className || ''}`}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold font-mono">Inventory Dashboard</h2>
                <div className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-500/30 rounded-full text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Live Sync
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {inventoryStats.map((stat, idx) => (
                    <div key={idx} className="p-4 bg-gray-900/50 rounded-lg border border-gray-800 flex items-start justify-between">
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className={`text-xs mt-1 ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                                {stat.trend} this week
                            </p>
                        </div>
                        <div className="p-2 bg-gray-800 rounded-lg">
                            <stat.icon size={20} className="text-gray-400" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-orange-400 mt-0.5" size={18} />
                <div>
                    <h4 className="text-sm font-semibold text-orange-400">Low Stock Alert</h4>
                    <p className="text-sm text-gray-400 mt-1">
                        "Tour 2024 Classic Tee (Size L)" is running low across all connected channels. Reorder recommended.
                    </p>
                </div>
            </div>
        </div>
    );
};
