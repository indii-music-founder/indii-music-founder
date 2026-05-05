import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AgentWorkspace from './components/AgentWorkspace';
import { CustomDashboard } from './components/CustomDashboard';
import { LayoutDashboard, Bot, Gem, ArrowRight, X, Sparkles } from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useMobile } from '@/hooks/useMobile';
import { useStore } from '@/core/store';
import { PlatformCard } from './components/PlatformCard';

type DashboardTab = 'agent' | 'custom';

/**
 * Premium Mesh Background for Dashboard
 */
function DashboardMeshBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    x: [0, 50, 0],
                    y: [0, 30, 0]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-dept-creative/20 blur-[120px]" 
            />
            <motion.div 
                animate={{ 
                    scale: [1, 1.3, 1],
                    x: [0, -40, 0],
                    y: [0, -60, 0]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
                className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-dept-social/20 blur-[120px]" 
            />
            <motion.div 
                animate={{ 
                    opacity: [0.1, 0.2, 0.1],
                    scale: [1, 1.1, 1]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-[20%] right-[10%] w-[35%] h-[35%] rounded-full bg-dept-marketing/10 blur-[100px]" 
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,102,0.03),transparent_70%)]" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay" />
        </div>
    );
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<DashboardTab>('agent');
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const { isAnyPhone } = useMobile();
    const setModule = useStore(state => state.setModule);

    return (
        <ModuleErrorBoundary moduleName="Dashboard">
            <div className="relative flex flex-col h-full bg-[#030303]">
                <DashboardMeshBackground />

                {/* Founders Round Investment Banner */}
                <AnimatePresence>
                    {!bannerDismissed && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                            className="relative overflow-hidden border-b border-amber-500/20 glass"
                        >
                            <div className="absolute inset-0 bg-linear-to-r from-amber-900/10 via-amber-800/5 to-purple-900/10 pointer-events-none" />
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-amber-500/10 to-transparent pointer-events-none" />

                            <div className={`relative z-10 flex items-center justify-between ${isAnyPhone ? 'px-4 py-3' : 'px-8 py-4'}`}>
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-amber-500/40 blur-md rounded-xl group-hover:bg-amber-500/60 transition-all" />
                                        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500 text-black flex-shrink-0 shadow-lg">
                                            <Gem size={20} className="animate-bounce" />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] font-mono">Founders Round</span>
                                            <motion.span 
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="px-2 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 uppercase tracking-widest"
                                            >
                                                Active
                                            </motion.span>
                                        </div>
                                        <p className={`text-gray-100 font-medium mt-1 leading-tight ${isAnyPhone ? 'text-xs' : 'text-sm'}`}>
                                            Secure your stake in the operating system for musical independence.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 flex-shrink-0 ml-6">
                                    <button
                                        onClick={() => setModule('founders-checkout')}
                                        className="group relative flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wider overflow-hidden"
                                    >
                                        <motion.div 
                                            animate={{ x: ['-200%', '200%'] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 5 }}
                                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent pointer-events-none" 
                                        />
                                        Back the Vision
                                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={() => setBannerDismissed(true)}
                                        className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
                                        aria-label="Dismiss"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Platform Info — Web vs Desktop */}
                <div className="relative z-10 px-8 py-4 bg-black/20 border-b border-white/5">
                    <PlatformCard />
                </div>

                {/* Tab Bar */}
                <div className={`relative z-10 flex-shrink-0 border-b border-white/5 flex gap-10 ${isAnyPhone ? 'px-4 gap-4' : 'px-8'}`}>
                    {([
                        { id: 'agent', label: 'Agent Workspace', icon: Bot, activeColor: 'var(--color-dept-creative)' },
                        { id: 'custom', label: 'Command Center', icon: LayoutDashboard, activeColor: '#ffffff' },
                    ] as const).map(({ id, label, icon: Icon, activeColor }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id as DashboardTab)}
                            className={`group relative flex items-center gap-2.5 h-14 text-xs font-black transition-all ${activeTab === id
                                ? 'text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === id ? 'bg-white/10' : 'group-hover:bg-white/5'}`}>
                                <Icon size={16} style={{ color: activeTab === id ? activeColor : undefined }} />
                            </div>
                            <span className="uppercase tracking-[0.15em]">{label}</span>
                            {activeTab === id && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-[-1px] left-0 right-0 h-[3px] rounded-t-full shadow-[0_-4px_10px_rgba(255,255,255,0.2)]"
                                    style={{ backgroundColor: activeColor }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="relative z-10 flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'agent' ? (
                            <motion.div
                                key="agent"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.3 }}
                                className="h-full"
                            >
                                <div className={`h-full overflow-y-auto w-full ${isAnyPhone ? 'p-4' : 'p-8'}`}>
                                    <div className="max-w-7xl mx-auto">
                                        <AgentWorkspace />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="custom"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.3 }}
                                className="h-full overflow-y-auto"
                            >
                                <div className={`max-w-7xl mx-auto ${isAnyPhone ? 'p-4' : 'p-8'}`}>
                                    <CustomDashboard />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </ModuleErrorBoundary>
    );
}

