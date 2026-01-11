import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Award, Zap, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const bananaTrendData = [
    { name: 'Week 1', sales: 1500, revenue: 1500 },
    { name: 'Week 2', sales: 2300, revenue: 2000 },
    { name: 'Week 3', sales: 3200, revenue: 3500 },
    { name: 'Week 4', sales: 4500, revenue: 4500 },
];

const bananaProPerformanceData = [
    { day: 'Mon', revenue: 1200 },
    { day: 'Tue', revenue: 2100 },
    { day: 'Wed', revenue: 1800 },
    { day: 'Thu', revenue: 2500 },
    { day: 'Fri', revenue: 3200 }, // Peak
    { day: 'Sat', revenue: 1800 },
    { day: 'Sun', revenue: 1500 },
];

export const MerchandiseAnalytics: React.FC = () => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            {/* Sales Volume Trend */}
            <motion.div
                whileHover={{ y: -5 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 blur-[80px] pointer-events-none rounded-full" />

                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                                <TrendingUp size={16} />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Revenue Velocity</h3>
                        </div>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-widest ml-1">Volume over 4 week period</p>
                    </div>
                </div>

                <div className="h-[250px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={bananaTrendData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#555"
                                tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#555"
                                tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    padding: '12px'
                                }}
                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                labelStyle={{ color: '#888', marginBottom: '4px', fontSize: '10px' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#14b8a6"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                animationDuration={2000}
                                animationEasing="ease-in-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Peak Cycle Performance */}
            <motion.div
                whileHover={{ y: -5 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[80px] pointer-events-none rounded-full" />

                <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                                <BarChart3 size={16} />
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Active Cycle</h3>
                        </div>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-widest ml-1">Daily Conversion Performance</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                        <Zap size={14} className="text-purple-400 fill-purple-400" />
                        <span className="text-purple-400 text-xs font-black uppercase">Top Performer</span>
                    </div>
                </div>

                <div className="h-[250px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bananaProPerformanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                            <XAxis
                                dataKey="day"
                                stroke="#555"
                                tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px'
                                }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Bar
                                dataKey="revenue"
                                radius={[8, 8, 0, 0]}
                                animationDuration={1500}
                                animationEasing="ease-out"
                            >
                                {bananaProPerformanceData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.revenue > 3000 ? '#A855F7' : '#22d3ee20'}
                                        stroke={entry.revenue > 3000 ? '#A855F7' : '#22d3ee40'}
                                        strokeWidth={1}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>
        </div>
    );
};
