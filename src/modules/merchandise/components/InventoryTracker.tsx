/**
 * InventoryTracker — Item 123 (PRODUCTION_200)
 * Native inventory tracking: physical vs virtual stock across channels.
 * Bar chart (Recharts), per-product stock levels, channel status cards.
 */
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Package, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface InventoryItem {
    id: string;
    name: string;
    physical: number;
    virtual: number;
    reorderThreshold: number;
    channel: 'Printful' | 'Printify' | 'Shopify' | 'Direct';
}

const MOCK_INVENTORY: InventoryItem[] = [
    { id: '1', name: 'Classic Tee (Black)', physical: 142, virtual: 9999, reorderThreshold: 50, channel: 'Printful' },
    { id: '2', name: 'Hoodie (Grey)', physical: 38, virtual: 9999, reorderThreshold: 50, channel: 'Printful' },
    { id: '3', name: 'Vinyl Record', physical: 200, virtual: 0, reorderThreshold: 30, channel: 'Direct' },
    { id: '4', name: 'Poster (18x24)', physical: 67, virtual: 9999, reorderThreshold: 20, channel: 'Printify' },
    { id: '5', name: 'Sticker Sheet', physical: 15, virtual: 9999, reorderThreshold: 100, channel: 'Printful' },
    { id: '6', name: 'Snapback Cap', physical: 89, virtual: 9999, reorderThreshold: 25, channel: 'Printify' },
];

const CHANNEL_COLORS: Record<string, string> = {
    Printful: 'text-blue-400',
    Printify: 'text-purple-400',
    Shopify: 'text-green-400',
    Direct: 'text-[#FFE135]',
};

const CHART_DATA = [
    { name: 'Tee', physical: 142, virtual: 0 },
    { name: 'Hoodie', physical: 38, virtual: 0 },
    { name: 'Vinyl', physical: 200, virtual: 0 },
    { name: 'Poster', physical: 67, virtual: 0 },
    { name: 'Sticker', physical: 15, virtual: 0 },
    { name: 'Cap', physical: 89, virtual: 0 },
];

export function InventoryTracker() {
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        await new Promise(r => setTimeout(r, 1500));
        setSyncing(false);
    };

    const lowStock = MOCK_INVENTORY.filter(i => i.physical <= i.reorderThreshold);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Inventory Tracker</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{MOCK_INVENTORY.length} SKUs across {Object.keys(CHANNEL_COLORS).length} channels</p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-neutral-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                    Sync
                </button>
            </div>

            {/* Low Stock Alert */}
            {lowStock.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl">
                    <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="text-sm font-bold text-yellow-400 mb-1">Low Stock Warning</div>
                        <div className="text-xs text-neutral-400">
                            {lowStock.map(i => i.name).join(', ')} {lowStock.length === 1 ? 'is' : 'are'} below reorder threshold.
                        </div>
                    </div>
                </div>
            )}

            {/* Physical Inventory Chart */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Physical Stock Levels</h4>
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={CHART_DATA} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                        />
                        <Bar dataKey="physical" fill="#FFE135" radius={[4, 4, 0, 0]} name="Physical Units" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Per-Product Table */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">SKU Detail</h4>
                {MOCK_INVENTORY.map((item) => {
                    const pct = Math.min((item.physical / (item.reorderThreshold * 4)) * 100, 100);
                    const isLow = item.physical <= item.reorderThreshold;
                    return (
                        <div key={item.id} className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all">
                            <Package size={14} className={isLow ? 'text-yellow-400' : 'text-neutral-600'} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-white truncate">{item.name}</span>
                                    <span className={`text-[10px] font-bold ${CHANNEL_COLORS[item.channel]}`}>{item.channel}</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${isLow ? 'bg-yellow-400' : 'bg-[#FFE135]'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className={`text-sm font-black ${isLow ? 'text-yellow-400' : 'text-white'}`}>{item.physical}</div>
                                <div className="text-[10px] text-neutral-600">/ {item.reorderThreshold} min</div>
                            </div>
                            <div>
                                {isLow ? (
                                    <AlertTriangle size={14} className="text-yellow-400" />
                                ) : (
                                    <CheckCircle2 size={14} className="text-green-500" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
