import React, { useState } from 'react';
import { ShoppingBag, Crown, Palette, TrendingUp, BarChart3, Zap, Package } from 'lucide-react';
import { BananaMerch } from './components/BananaMerch';
import { BananaProMerch } from './components/BananaProMerch';

function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
    const isPositive = trend.startsWith('+');
    return (
        <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
            <div className="flex justify-between items-start mb-2">
                <span className="text-gray-400 text-xs uppercase font-medium tracking-wider">{title}</span>
                {icon}
            </div>
            <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-white">{value}</span>
                <span className={`text-xs font-medium mb-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {trend}
                </span>
            </div>
        </div>
    );
}
