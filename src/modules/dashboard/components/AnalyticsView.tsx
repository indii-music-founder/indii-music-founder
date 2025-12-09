import React from 'react';
import { BarChart, Activity, Zap, MessageSquare } from 'lucide-react';

export default function AnalyticsView() {
    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <Activity className="text-green-400" size={24} />
                <h2 className="text-lg font-bold text-white">Studio Stats</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Zap size={14} />
                        <span className="text-xs uppercase tracking-wider">Generations</span>
                    </div>
                    <div className="text-2xl font-bold text-white">1,248</div>
                </div>

                <div className="bg-[#0d1117] p-4 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <MessageSquare size={14} />
                        <span className="text-xs uppercase tracking-wider">Messages</span>
                    </div>
                    <div className="text-2xl font-bold text-white">8,901</div>
                </div>
            </div>

            {/* Placeholder Chart */}
            <div className="mt-6 h-32 flex items-end justify-between px-2 gap-1 opacity-50">
                {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                    <div key={i} className="w-full bg-green-500/20 rounded-t" style={{ height: `${h}%` }}></div>
                ))}
            </div>
        </div>
    );
}
