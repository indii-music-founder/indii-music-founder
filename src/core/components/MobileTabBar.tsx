import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getColorForModule } from '@/core/theme/moduleColors';
import {
    LayoutDashboard, Palette, MessageCircle, DollarSign, Menu, X, Plus
} from 'lucide-react';
import { haptic } from '@/lib/mobile';
import { type ModuleId } from '@/core/constants';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { useMobile } from '@/hooks/useMobile';
import { QuickCapture } from '@/modules/capture/QuickCapture';

/**
 * MobileTabBar — Persistent iOS-style bottom tab bar for phone-class viewports.
 *
 * Replaces the floating FAB from MobileNav with a fixed, always-visible
 * 5-icon tab bar at the bottom of the screen. The 5th tab ("More")
 * opens the existing MobileNav bottom-sheet drawer.
 *
 * Visible only on phone viewports (≤ 640px). Hides on tablet/desktop
 * where the sidebar takes over.
 */

interface TabItem {
    id: ModuleId | 'more';
    icon: React.ElementType;
    label: string;
}

const TABS: TabItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'creative', icon: Palette, label: 'Creative' },
    { id: 'agent', icon: MessageCircle, label: 'Chat' },
    { id: 'finance', icon: DollarSign, label: 'Finance' },
    { id: 'more', icon: Menu, label: 'More' },
];

// Full navigation items for the "More" drawer (mirrors MobileNav structure)
interface NavItem {
    id: ModuleId;
    label: string;
}

const MORE_SECTIONS: { title: string; items: NavItem[] }[] = [
    {
        title: "Manager's Office",
        items: [
            { id: 'brand', label: 'Brand Manager' },
            { id: 'road', label: 'Road Manager' },
            { id: 'campaign', label: 'Campaign Manager' },
            { id: 'agent', label: 'Booking Agent' },
            { id: 'publicist', label: 'Publicist' },
            { id: 'creative', label: 'Creative Director' },
            { id: 'video', label: 'Video Producer' },
        ],
    },
    {
        title: 'Departments',
        items: [
            { id: 'marketing', label: 'Marketing' },
            { id: 'social', label: 'Social Media' },
            { id: 'legal', label: 'Legal' },
            { id: 'publishing', label: 'Publishing' },
            { id: 'finance', label: 'Finance' },
            { id: 'licensing', label: 'Licensing' },
        ],
    },
    {
        title: 'Tools',
        items: [
            { id: 'merch', label: 'Merchandise' },
            { id: 'audio-analyzer', label: 'Audio Analyzer' },
            { id: 'workflow', label: 'Workflow Builder' },
            { id: 'knowledge', label: 'Knowledge Base' },
            { id: 'distribution', label: 'Distribution' },
            { id: 'history', label: 'History' },
        ],
    },
];

export const MobileTabBar: React.FC = () => {
    const { isAnyPhone } = useMobile();
    const { currentModule, setModule } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            setModule: state.setModule,
        }))
    );
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);

    // Only render on phone-class viewports
    if (!isAnyPhone) return null;

    const handleTabPress = (tab: TabItem) => {
        haptic('light');
        if (tab.id === 'more') {
            setIsMoreOpen(true);
        } else {
            setModule(tab.id as ModuleId);
        }
    };

    const handleMoreItemPress = (id: ModuleId) => {
        haptic('light');
        setModule(id);
        setIsMoreOpen(false);
    };

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
            haptic('light');
            setIsMoreOpen(false);
        }
    };

    return (
        <>
            {/* QuickCapture FAB — floating above tab bar center */}
            {/* Hidden on modules with their own bottom action bar (Road Mode has voice bar) */}
            {currentModule !== 'road' && (
                <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                        haptic('medium');
                        setIsQuickCaptureOpen(true);
                    }}
                    className="fixed z-[102] w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shadow-teal-500/30 flex items-center justify-center active:shadow-teal-500/50 transition-shadow"
                    style={{
                        bottom: `calc(56px + env(safe-area-inset-bottom, 0px) + 16px)`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                    aria-label="Quick capture new contact"
                >
                    <Plus size={22} className="text-white" strokeWidth={2.5} />
                </motion.button>
            )}

            {/* QuickCapture Bottom Sheet */}
            <QuickCapture
                isOpen={isQuickCaptureOpen}
                onClose={() => setIsQuickCaptureOpen(false)}
            />

            {/* Persistent Bottom Tab Bar */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-[101] bg-[#0d0d0d]/95 backdrop-blur-xl border-t border-white/[0.06]"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
                role="tablist"
                aria-label="Main navigation"
            >
                <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
                    {TABS.map((tab) => {
                        const isActive = tab.id !== 'more' && currentModule === tab.id;
                        const colors = tab.id !== 'more' ? getColorForModule(tab.id as ModuleId) : null;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabPress(tab)}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={tab.label}
                                className={`
                                    flex flex-col items-center justify-center gap-0.5 w-[64px] h-[44px] rounded-xl
                                    transition-all duration-200 active:scale-90
                                    ${isActive
                                        ? 'text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                    }
                                `}
                            >
                                <div className="relative">
                                    <tab.icon
                                        size={22}
                                        className={isActive && colors ? colors.text : ''}
                                        strokeWidth={isActive ? 2.5 : 1.5}
                                    />
                                    {/* Active indicator dot */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="tab-indicator"
                                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current"
                                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </div>
                                <span className={`text-[10px] leading-tight ${isActive ? 'font-semibold' : 'font-normal'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* "More" Bottom Sheet Drawer */}
            <AnimatePresence>
                {isMoreOpen && (
                    <div className="fixed inset-0 z-[103] flex items-end justify-center pointer-events-none">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                            onClick={() => {
                                haptic('light');
                                setIsMoreOpen(false);
                            }}
                            aria-hidden="true"
                        />

                        {/* Drawer Content */}
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-label="All modules"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0.1, bottom: 0.8 }}
                            onDragEnd={handleDragEnd}
                            className="relative w-full max-w-lg bg-[#0d0d0d] border-t border-white/10 rounded-t-3xl flex flex-col max-h-[80vh] shadow-2xl pointer-events-auto"
                            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                        >
                            {/* Drag Handle */}
                            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none">
                                <div className="w-12 h-1 bg-white/20 rounded-full" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                                <h2 className="text-base font-semibold text-white">All Modules</h2>
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        setIsMoreOpen(false);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95 text-white/60 hover:text-white"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Navigation */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-5">
                                {MORE_SECTIONS.map((section) => (
                                    <div key={section.title}>
                                        <h3 className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                                            {section.title}
                                        </h3>
                                        <div className="space-y-0.5">
                                            {section.items.map((item) => {
                                                const isActive = currentModule === item.id;
                                                const colors = getColorForModule(item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleMoreItemPress(item.id)}
                                                        className={`
                                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
                                                            ${isActive
                                                                ? `${colors.bg} ${colors.text} ring-1 ${colors.border} font-semibold`
                                                                : `text-gray-300 ${colors.hoverBg} ${colors.hoverText} font-medium`
                                                            }
                                                        `}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                {/* Bottom padding */}
                                <div className="h-4" />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
