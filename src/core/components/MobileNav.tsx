import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getColorForModule } from '@/core/theme/moduleColors';
import {
    Briefcase, Users, Megaphone, Network, Mic, Palette, Film,
    Scale, Book, DollarSign, FileText, ShoppingBag, Radio, Globe,
    Menu, X, Layout, Clock
} from 'lucide-react';
import { haptic } from '@/lib/mobile';
import { type ModuleId } from '@/core/constants';
import { motion, AnimatePresence, PanInfo } from 'motion';

interface NavItem {
    id: ModuleId;
    icon: React.ElementType;
    label: string;
}

export const MobileNav = () => {
    const { currentModule, setModule } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            setModule: state.setModule
        }))
    );
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const hasOpened = useRef(false);

    // Focus management
    useEffect(() => {
        if (isOpen) {
            hasOpened.current = true;
            // Small delay to ensure DOM is ready and animation frame is hit
            requestAnimationFrame(() => {
                closeButtonRef.current?.focus();
            });
        } else if (hasOpened.current) {
            triggerRef.current?.focus();
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Grouped navigation items (mirrored from Sidebar.tsx)
    const managerItems: NavItem[] = [
        { id: 'brand', icon: Briefcase, label: 'Brand Manager' },
        { id: 'road', icon: Users, label: 'Road Manager' },
        { id: 'campaign', icon: Megaphone, label: 'Campaign Manager' },
        { id: 'agent', icon: Network, label: 'Agent Tools' },
        { id: 'publicist', icon: Mic, label: 'Publicist' },
        { id: 'creative', icon: Palette, label: 'Creative Director' },
        { id: 'video', icon: Film, label: 'Video Producer' },
    ];

    const departmentItems: NavItem[] = [
        { id: 'marketing', icon: Megaphone, label: 'Marketing Department' },
        { id: 'social', icon: Network, label: 'Social Media Department' },
        { id: 'legal', icon: Scale, label: 'Legal Department' },
        { id: 'publishing', icon: Book, label: 'Publishing Department' },
        { id: 'finance', icon: DollarSign, label: 'Finance Department' },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems: NavItem[] = [
        { id: 'merch', icon: ShoppingBag, label: 'Merch Tool' },
        { id: 'audio-analyzer', icon: Radio, label: 'Audio Analyzer' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
        { id: 'knowledge', icon: Book, label: 'Knowledge Base' },
        { id: 'history', icon: Clock, label: 'History' },
    ];

    const handleItemClick = (id: ModuleId) => {
        haptic('light');
        setModule(id);
        setIsOpen(false);
    };

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
            haptic('light');
            setIsOpen(false);
        }
    };

    const MenuItem = ({ item }: { item: NavItem }) => {
        const isActive = currentModule === item.id;
        const colors = getColorForModule(item.id);

        return (
            <button
                onClick={() => handleItemClick(item.id)}
                className={`
                    w-full flex items-center gap-3 p-3 rounded-xl transition-all
                    ${isActive
                        ? `${colors.bg} ${colors.text} ring-1 ${colors.border}`
                        : `text-gray-300 ${colors.hoverBg} ${colors.hoverText}`
                    }
                `}
            >
                <item.icon size={20} className={isActive ? 'drop-shadow-sm' : ''} />
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <>
            {/* FAB Trigger - Replaces Bottom Bar */}
            <button
                ref={triggerRef}
                onClick={() => {
                    haptic('medium');
                    setIsOpen(true);
                }}
                className="md:hidden fixed bottom-32 right-6 z-[102] p-3.5 bg-background border border-white/10 rounded-full shadow-lg shadow-black/50 active:scale-95 transition-transform hover:bg-white/10 text-white"
                aria-label="Open Navigation"
                aria-expanded={isOpen}
                aria-controls="mobile-nav-drawer"
            >
                <Menu size={24} />
            </button>

            {/* Full Screen Drawer with Animations */}
            <AnimatePresence>
                {isOpen && (
                    <div className="md:hidden fixed inset-0 z-[103] flex items-end justify-center pointer-events-none">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                            onClick={() => {
                                haptic('light');
                                setIsOpen(false);
                            }}
                            aria-hidden="true"
                        />

                        {/* Menu Content */}
                        <motion.div
                            id="mobile-nav-drawer"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="mobile-nav-title"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0.1, bottom: 0.8 }}
                            onDragEnd={handleDragEnd}
                            className="relative w-full max-w-lg bg-background border-t border-white/10 rounded-t-3xl mobile-safe-bottom flex flex-col max-h-[85vh] shadow-2xl pointer-events-auto"
                        >
                            {/* Drag Handle */}
                            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none">
                                <div className="w-12 h-1 bg-white/20 rounded-full" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                <h2 id="mobile-nav-title" className="text-lg font-semibold text-white">Navigation</h2>
                                <button
                                    ref={closeButtonRef}
                                    onClick={() => {
                                        haptic('light');
                                        setIsOpen(false);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors active:scale-95 text-white/60 hover:text-white"
                                    aria-label="Close menu"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

                                {/* Return to HQ */}
                                <button
                                    onClick={() => handleItemClick('dashboard')}
                                    className={`
                                        w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-4
                                        ${currentModule === 'dashboard'
                                            ? 'bg-white/10 text-white ring-1 ring-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }
                                    `}
                                >
                                    <Layout size={20} />
                                    <span className="text-sm font-semibold">Return to HQ</span>
                                </button>

                                {/* Manager's Office */}
                                <div className="space-y-1">
                                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manager's Office</h3>
                                    {managerItems.map(item => (
                                        <MenuItem key={item.id} item={item} />
                                    ))}
                                </div>

                                {/* Departments */}
                                <div className="space-y-1">
                                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Departments</h3>
                                    {departmentItems.map(item => (
                                        <MenuItem key={item.id} item={item} />
                                    ))}
                                </div>

                                {/* Tools */}
                                <div className="space-y-1">
                                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tools</h3>
                                    {toolItems.map(item => (
                                        <MenuItem key={item.id} item={item} />
                                    ))}
                                </div>

                                {/* Bottom Padding for scroll */}
                                <div className="h-6" />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
