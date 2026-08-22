import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AgentWorkspace from './components/AgentWorkspace';
import { CustomDashboard } from './components/CustomDashboard';
import { Gem, ArrowRight, X } from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useMobile } from '@/hooks/useMobile';
import { useStore } from '@/core/store';
import { PlatformCard } from './components/PlatformCard';
import { useTranslation } from 'react-i18next';
import { useIsFounderTier } from '@/hooks/useIsFounderTier';
import { scrollModuleScrollerToTopAfterPaint } from '@/utils/scrollModuleScroller';

const BANNER_DISMISS_KEY = 'indii_founders_banner_dismissed';

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
        </div>
    );
}

export default function Dashboard() {
    const { t } = useTranslation();
    // Founders/paid seats already own what this banner sells — it never renders
    // for them. Free users can dismiss it, and the dismissal survives refreshes.
    const isFounderTier = useIsFounderTier();
    const [bannerDismissed, setBannerDismissed] = useState(() => {
        try {
            return localStorage.getItem(BANNER_DISMISS_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const dismissBanner = () => {
        setBannerDismissed(true);
        try {
            localStorage.setItem(BANNER_DISMISS_KEY, 'true');
        } catch {
            /* private mode: dismissal lives for the session only */
        }
        // Collapsing shifts the layout — land the view back on the indii logo
        // and the "My Dashboard" title instead of wherever mid-scroll we were.
        scrollModuleScrollerToTopAfterPaint();
    };
    const { isAnyPhone } = useMobile();
    const setModule = useStore(state => state.setModule);

    return (
        <ModuleErrorBoundary moduleName="Dashboard">
            <div className="relative flex flex-col h-full bg-[#030303]">
                <DashboardMeshBackground />

                {/* Founders Round Investment Banner */}
                <AnimatePresence>
                    {!isFounderTier && !bannerDismissed && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                            className="relative overflow-hidden border-b border-amber-500/20 glass"
                        >
                            <div className="absolute inset-0 bg-linear-to-r from-amber-900/10 via-amber-800/5 to-green-900/10 pointer-events-none" />
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
                                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] font-mono">{t('dashboard.foundersRound')}</span>
                                            <motion.span 
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="px-2 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 uppercase tracking-widest"
                                            >
                                                {t('dashboard.active')}
                                            </motion.span>
                                        </div>
                                        <p className={`text-gray-100 font-medium mt-1 leading-tight ${isAnyPhone ? 'text-xs' : 'text-sm'}`}>
                                            {t('dashboard.foundersBannerText')}
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
                                        {t('dashboard.backVision')}
                                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={dismissBanner}
                                        className="p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
                                        aria-label={t('dashboard.dismiss')}
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

                {/* ISSUE-1291: the Agent Workspace / Command Center tab bar is gone.
                    The two were never peers — this room asks "what do you want to
                    make?", the stats answer "how am I doing?" — and pairing them as
                    sibling tabs meant the more useful one lost, because a tab you can
                    overlook once you overlook forever. They are one room now, so
                    there is no longer a second tab to miss. */}
                <div className="relative z-10 flex-1 overflow-hidden">
                    <div className={`@container h-full w-full ${isAnyPhone ? 'px-4' : 'px-8'}`}>
                        <div className="mx-auto h-full max-w-7xl">
                            <AgentWorkspace studioSlot={<CustomDashboard />} />
                        </div>
                    </div>
                </div>
            </div>
        </ModuleErrorBoundary>
    );
}
