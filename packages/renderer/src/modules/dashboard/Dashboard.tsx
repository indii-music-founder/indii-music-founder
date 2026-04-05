import React, { useState } from 'react';
import { motion } from 'motion/react';
import AgentWorkspace from './components/AgentWorkspace';
import { CustomDashboard } from './components/CustomDashboard';
import { LayoutDashboard, Bot, Gem, ArrowRight, X } from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useMobile } from '@/hooks/useMobile';
import { useStore } from '@/core/store';
import { PlatformCard } from './components/PlatformCard';

type DashboardTab = 'agent' | 'custom';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<DashboardTab>('agent');
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const { isAnyPhone } = useMobile();
    const setModule = useStore(state => state.setModule);

    return (
        <ModuleErrorBoundary moduleName="Dashboard">
            {/* Founders Round Investment Banner */}
            {!bannerDismissed && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative overflow-hidden border-b border-amber-500/20"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-900/20 via-amber-800/10 to-purple-900/15 pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-amber-500/5 to-transparent pointer-events-none" />

                    <div className={`relative z-10 flex items-center justify-between ${isAnyPhone ? 'px-3 py-3' : 'px-6 py-4'}`}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex-shrink-0">
                                <Gem size={18} className="text-amber-400" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono text-amber-500/80 uppercase tracking-widest">Founders Round</span>
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 uppercase tracking-wider">Open</span>
                                </div>
                                <p className={`text-gray-300 font-medium mt-0.5 ${isAnyPhone ? 'text-xs' : 'text-sm'}`}>
                                    Be part of the foundation. Invest in the operating system for independent artists.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <button
                                onClick={() => setModule('founders-checkout')}
                                className="group flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Back the Vision
                                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                            <button
                                onClick={() => setBannerDismissed(true)}
                                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
                                aria-label="Dismiss"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Platform Info — Web vs Desktop */}
            <PlatformCard />

            {/* Tab Bar */}
            <div className={`flex-shrink-0 border-b border-white/5 flex gap-6 ${isAnyPhone ? 'px-3 gap-3' : 'px-6'}`}>
                {([
                    { id: 'agent', label: 'Agent Workspace', icon: Bot, activeClass: 'border-indigo-500 text-indigo-400' },
                    { id: 'custom', label: 'My Dashboard', icon: LayoutDashboard, activeClass: 'border-white text-white' },
                ] as const).map(({ id, label, icon: Icon, activeClass }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as DashboardTab)}
                        className={`flex items-center gap-2 h-12 text-xs font-bold border-b-2 transition-all ${activeTab === id
                            ? activeClass
                            : 'border-transparent text-muted-foreground hover:text-white'
                            }`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'agent' ? (
                    <div className={`min-h-full bg-bg-dark overflow-y-auto w-full ${isAnyPhone ? 'p-3' : 'p-8'}`}>
                        <div className="max-w-7xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            >
                                <AgentWorkspace />
                            </motion.div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto">
                        <CustomDashboard />
                    </div>
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
