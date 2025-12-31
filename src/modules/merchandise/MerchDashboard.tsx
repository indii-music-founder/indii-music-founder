import React from 'react';
import { MerchLayout } from './components/Layout';
import { MerchCard } from './components/MerchCard';
import { BananaButton } from './components/BananaButton';
import { TrendingUp, ShoppingBag, DollarSign, Plus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MerchDashboard() {
    const navigate = useNavigate();

    return (
        <MerchLayout>
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-1">Morning, Chief 🍌</h2>
                        <p className="text-neutral-400">Your empire is ripening nicely.</p>
                    </div>
                    <BananaButton onClick={() => navigate('/merchandise/design')} glow size="lg" className="rounded-full">
                        <Plus size={18} />
                        Peel New Design
                    </BananaButton>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatsCard
                        title="Banana Juice (Rev)"
                        value="$12,450"
                        change="+15%"
                        icon={<DollarSign className="text-[#FFE135]" />}
                    />
                    <StatsCard
                        title="Units Peeled"
                        value="842"
                        change="+8%"
                        icon={<ShoppingBag className="text-[#FFE135]" />}
                    />
                    <StatsCard
                        title="Conversion Rate"
                        value="3.2%"
                        change="+1.1%"
                        icon={<TrendingUp className="text-[#FFE135]" />}
                    />
                </div>

                {/* Main Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Top Sellers */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Top Killers</h3>
                            <button className="text-xs text-[#FFE135] hover:underline">View All</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <MerchCard key={i} className="group p-4 flex items-center gap-4 cursor-pointer">
                                    <div className="w-20 h-24 bg-neutral-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-all" />
                                        <span className="text-2xl">👕</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white group-hover:text-[#FFE135] transition-colors">Golden Peel Tee</h4>
                                        <p className="text-sm text-neutral-500">$35.00 • 124 Sold</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[#FFE135] font-mono font-bold">$4.3k</span>
                                    </div>
                                </MerchCard>
                            ))}
                        </div>
                    </div>

                    {/* Recent Designs */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Fresh Prints</h3>
                            <button className="text-xs text-[#FFE135] hover:underline">Drafts</button>
                        </div>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                                    <div className="w-12 h-12 bg-neutral-800 rounded-md border border-white/10 flex items-center justify-center">
                                        <span className="text-lg">🎨</span>
                                    </div>
                                    <div className="flex-1">
                                        <h5 className="text-sm font-medium text-white group-hover:text-[#FFE135]">Neon Summer V2</h5>
                                        <p className="text-xs text-neutral-500">Edited 2h ago</p>
                                    </div>
                                    <ArrowRight size={14} className="text-neutral-600 group-hover:text-white" />
                                </div>
                            ))}
                        </div>

                        <MerchCard className="p-6 bg-gradient-to-br from-[#FFE135]/10 to-transparent border-[#FFE135]/20">
                            <h4 className="font-bold text-[#FFE135] mb-2">Campaign Ready?</h4>
                            <p className="text-xs text-neutral-400 mb-4">You have 3 approved designs ready for production.</p>
                            <BananaButton size="sm" variant="outline" className="w-full">
                                Launch Campaign
                            </BananaButton>
                        </MerchCard>
                    </div>
                </div>
            </div>
        </MerchLayout>
    );
}

function StatsCard({ title, value, change, icon }: { title: string, value: string, change: string, icon: React.ReactNode }) {
    return (
        <MerchCard className="p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFE135]/10 flex items-center justify-center border border-[#FFE135]/20">
                    {icon}
                </div>
                <span className="text-xs font-mono text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-1 rounded">{change}</span>
            </div>
            <div className="space-y-1">
                <p className="text-sm text-neutral-500 uppercase tracking-widest">{title}</p>
                <h3 className="text-3xl font-black text-white">{value}</h3>
            </div>
        </MerchCard>
    )
}
