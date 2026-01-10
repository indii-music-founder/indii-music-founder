import React from 'react';
import { Map, Truck, Coffee, Settings, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface RoadManagerSidebarProps {
    activeTab: 'planning' | 'on-the-road' | 'rider';
    setActiveTab: (tab: 'planning' | 'on-the-road' | 'rider') => void;
}

export const RoadManagerSidebar: React.FC<RoadManagerSidebarProps> = ({ activeTab, setActiveTab }) => {
    const navItems = [
        { id: 'planning', label: 'Tour Planning', icon: Map, description: 'Logistics & Routing' },
        { id: 'on-the-road', label: 'On The Road', icon: Truck, description: 'Live Telemetry' },
        { id: 'rider', label: 'Hospitality Rider', icon: Coffee, description: 'Inventory & Needs' },
    ] as const;

    return (
        <div className="w-64 bg-[#0d1117] border-r border-gray-800 flex flex-col h-full flex-shrink-0">
            <div className="p-6 border-b border-gray-800/50">
                <h1 className="text-xl font-black flex items-center gap-2 tracking-tighter uppercase italic text-white/90">
                    <Truck className="text-yellow-500" size={24} />
                    Road Mgr
                </h1>
                <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-[0.2em]">
                    Logistics V2.1
                </p>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left border ${isActive
                                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="clicked-sidebar"
                                    className="absolute left-0 w-1 h-8 bg-yellow-500 rounded-r-full"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}

                            <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800/50 text-gray-600 group-hover:text-gray-400'}`}>
                                <Icon size={18} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-white' : ''}`}>
                                    {item.label}
                                </div>
                                <div className="text-[10px] text-gray-600 font-medium truncate">
                                    {item.description}
                                </div>
                            </div>

                            {isActive && (
                                <motion.div
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <ChevronRight size={14} className="text-yellow-500/50" />
                                </motion.div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Status / User Info could go here */}
            <div className="p-4 border-t border-gray-800/50">
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <div className="flex-1">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">System Status</div>
                        <div className="text-xs text-white font-mono">ONLINE</div>
                    </div>
                    <Settings size={14} className="text-gray-600 hover:text-white cursor-pointer transition-colors" />
                </div>
            </div>
        </div>
    );
};
