import React from 'react';
import { Activity, TrendingUp, Users, MousePointerClick } from 'lucide-react';

// Mock chart component since we don't have a charting library installed
const MockLineChart = () => (
    <div className="relative h-64 w-full bg-gray-900/50 rounded-lg border border-gray-800 flex items-end justify-between p-4 overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-10 pointer-events-none">
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
            <div className="w-full h-px bg-white"></div>
        </div>

        {/* Data points (Mock) */}
        {[30, 45, 35, 60, 55, 70, 65, 80, 75, 90].map((h, i) => (
            <div key={i} className="w-8 bg-gradient-to-t from-purple-600/20 to-purple-500/50 rounded-t-sm relative group" style={{ height: `${h}%` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-black text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {h}
                </div>
            </div>
        ))}
    </div>
);

export default function SalesAnalytics() {
    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={20} className="text-purple-500" />
                Sales Analytics
            </h3>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-gray-500 uppercase font-bold">Conversion Rate</span>
                        <TrendingUp size={16} className="text-green-500" />
                    </div>
                    <span className="text-2xl font-bold text-white">4.2%</span>
                    <span className="text-xs text-green-500 ml-2">+0.5%</span>
                </div>
                <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-gray-500 uppercase font-bold">Total Visitors</span>
                        <Users size={16} className="text-blue-500" />
                    </div>
                    <span className="text-2xl font-bold text-white">12.5k</span>
                    <span className="text-xs text-blue-500 ml-2">+12%</span>
                </div>
                <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-gray-500 uppercase font-bold">Click Rate</span>
                        <MousePointerClick size={16} className="text-yellow-500" />
                    </div>
                    <span className="text-2xl font-bold text-white">18.3%</span>
                    <span className="text-xs text-gray-500 ml-2">--</span>
                </div>
                <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-gray-500 uppercase font-bold">Avg. Order</span>
                        <Activity size={16} className="text-pink-500" />
                    </div>
                    <span className="text-2xl font-bold text-white">$24.00</span>
                    <span className="text-xs text-green-500 ml-2">+2%</span>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-[#161b22] p-6 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-bold text-white text-sm">Revenue Over Time</h4>
                    <select className="bg-gray-900 border border-gray-700 text-xs text-white rounded px-2 py-1 outline-none">
                        <option>Last 30 Days</option>
                        <option>Last 90 Days</option>
                        <option>This Year</option>
                    </select>
                </div>
                <MockLineChart />
            </div>
        </div>
    );
}
