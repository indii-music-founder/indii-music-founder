import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Award, DollarSign } from 'lucide-react';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Banana Sales Trend */}
            <div className="bg-[#161b22]/50 backdrop-blur-sm border border-yellow-500/20 rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-6 bg-yellow-400 rounded-full inline-block" />
                            Banana Sales Trend
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">Standard Product Performance</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full flex items-center gap-2">
                        <TrendingUp size={14} className="text-yellow-400" />
                        <span className="text-yellow-400 text-xs font-bold">+150 Units</span>
                    </div>
                </div>

                <div className="h-[200px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={bananaTrendData}>
                            <defs>
                                <linearGradient id="colorBanana" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#FBbf24" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#FBbf24" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#FBbf24" strokeWidth={3} fillOpacity={1} fill="url(#colorBanana)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Banana Pro Performance */}
            <div className="bg-[#161b22]/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-6 bg-purple-500 rounded-full inline-block" />
                            Banana Pro Performance
                        </h3>
                        <p className="text-gray-400 text-xs mt-1">Premium/Limited Edition</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full flex items-center gap-2">
                        <Award size={14} className="text-purple-400" />
                        <span className="text-purple-400 text-xs font-bold">Top Seller</span>
                    </div>
                </div>

                <div className="h-[200px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bananaProPerformanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="day" stroke="#666" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                {bananaProPerformanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.revenue > 3000 ? '#A855F7' : '#EAB308'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
