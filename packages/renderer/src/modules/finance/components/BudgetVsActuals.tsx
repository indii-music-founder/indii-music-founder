import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

/* ================================================================== */
/*  Budget vs. Actuals — Finance Tracking Module                       */
/* ================================================================== */

interface BudgetCategory {
    id: string;
    label: string;
    budgeted: number;
    actual: number;
    color: string;
}

const INITIAL_CATEGORIES: BudgetCategory[] = [];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
                <p className="font-bold text-white mb-2">{label}</p>
                {payload.map((p) => (
                    <p key={p.name} style={{ color: p.fill }} className="font-medium">
                        {p.name}: ${p.value.toLocaleString()}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export function BudgetVsActuals() {
    const [categories, setCategories] = useState<BudgetCategory[]>(INITIAL_CATEGORIES);

    const updateBudgeted = (id: string, val: string) => {
        const num = parseFloat(val) || 0;
        setCategories(prev => prev.map(c => c.id === id ? { ...c, budgeted: num } : c));
    };

    const totalBudget = categories.reduce((sum, c) => sum + c.budgeted, 0);
    const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);
    const totalVariance = totalBudget - totalActual;

    const chartData = categories.map(c => ({
        name: c.label,
        Budget: c.budgeted,
        Actual: c.actual,
    }));

    return (
        <div className="space-y-6 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <BarChart3 size={16} className="text-indigo-400" />
                </div>
                <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">Budget vs. Actuals</h2>
                    <p className="text-[10px] text-gray-500">Track spending across budget categories</p>
                </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Budget</p>
                    <p className="text-xl font-black text-white mt-1">${totalBudget.toLocaleString()}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Actual</p>
                    <p className="text-xl font-black text-white mt-1">${totalActual.toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-3 ${totalVariance >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Variance</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        {totalVariance > 0 ? (
                            <TrendingDown size={16} className="text-emerald-400" />
                        ) : totalVariance < 0 ? (
                            <TrendingUp size={16} className="text-red-400" />
                        ) : (
                            <Minus size={16} className="text-gray-400" />
                        )}
                        <p className={`text-xl font-black ${totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {totalVariance >= 0 ? '+' : ''}{totalVariance.toLocaleString()}
                        </p>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">{totalVariance >= 0 ? 'Under budget' : 'Over budget'}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Budget vs. Actual by Category</h3>
                {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center">
                        <BarChart3 size={24} className="text-gray-600 mb-2" />
                        <p className="text-xs font-bold text-gray-400">No Budget Defined</p>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">Create budget categories to track your spending and start managing your finances.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                            <Bar dataKey="Budget" fill="#6366f1" opacity={0.7} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Actual" fill="#f59e0b" opacity={0.9} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Category Table */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                {categories.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center">
                        <p className="text-xs text-gray-500">Your budget categories will appear here once created.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-5 gap-3 px-4 py-2.5 border-b border-white/5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest col-span-1">Category</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Budgeted</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actual</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest col-span-2 text-center">Progress</span>
                        </div>
                        {categories.map(c => {
                            const variance = c.budgeted - c.actual;
                            const pct = c.budgeted > 0 ? Math.min((c.actual / c.budgeted) * 100, 100) : 0;
                            const isOver = c.actual > c.budgeted;
                            return (
                                <div key={c.id} className="grid grid-cols-5 gap-3 items-center px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                                    {/* Label */}
                                    <div className="flex items-center gap-2 col-span-1">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                                        <span className="text-xs text-white font-medium">{c.label}</span>
                                    </div>

                                    {/* Budgeted (editable) */}
                                    <div className="text-right">
                                        <div className="relative inline-flex items-center">
                                            <span className="text-[10px] text-gray-600 mr-0.5">$</span>
                                            <input
                                                type="number"
                                                value={c.budgeted}
                                                onChange={e => updateBudgeted(c.id, e.target.value)}
                                                className="w-20 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Actual */}
                                    <div className="text-right">
                                        <span className={`text-xs font-bold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                            ${c.actual.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Bar & Variance */}
                                    <div className="col-span-2 flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: isOver ? '#ef4444' : c.color,
                                                }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold w-16 text-right flex-shrink-0 ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {variance >= 0 ? '+' : ''}${variance.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Totals Row */}
                        <div className="grid grid-cols-5 gap-3 items-center px-4 py-3 bg-white/[0.02] border-t border-white/10">
                            <span className="text-xs font-black text-white uppercase tracking-wider col-span-1">Total</span>
                            <span className="text-xs font-black text-white text-right">${totalBudget.toLocaleString()}</span>
                            <span className={`text-xs font-black text-right ${totalActual > totalBudget ? 'text-red-400' : 'text-emerald-400'}`}>${totalActual.toLocaleString()}</span>
                            <div className="col-span-2 flex justify-end">
                                <span className={`text-xs font-black ${totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {totalVariance >= 0 ? '+' : ''}${totalVariance.toLocaleString()} {totalVariance >= 0 ? 'under' : 'over'}
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
