import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePowerState } from '@/core/hooks/usePowerState';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { getColorForModule } from '../theme/moduleColors';
import { type ModuleId } from '@/core/constants';
import { Scale, Music, Megaphone, Layout, Network, Film, Book, Briefcase, Users, Radio, PenTool, DollarSign, FileText, Mic, ChevronLeft, ChevronRight, Globe, LogOut, Shirt, ShoppingBag, Activity, Clock, Palette, AudioLines, Volume2, Search, Settings, Gem } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/core/components/ui/ThemeToggle';
import { BiometricToggle } from '@/core/components/ui/BiometricToggle';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useGatedModules } from '@/config/featureFlags';

// Navigation debounce interval in ms — prevents Firestore b815 crash from rapid module switching
const NAV_DEBOUNCE_MS = 150;

interface SidebarItem {
    id: ModuleId;
    icon: React.ElementType;
    label: string;
}

// Item 360: Memoized NavItem — prevents re-render on every Sidebar store subscription update
const NavItem = React.memo(function NavItem({
    item,
    isActive,
    isSidebarOpen,
    onNavigate,
}: {
    item: SidebarItem;
    isActive: boolean;
    isSidebarOpen: boolean;
    onNavigate: (id: ModuleId) => void;
}) {
    const colors = getColorForModule(item.id);

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => {
                            if (item.id === 'history') {
                                useStore.setState({
                                    isAgentOpen: true,
                                    rightPanelView: 'archives'
                                });
                                return;
                            }
                            onNavigate(item.id);
                        }}
                        style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
                        className={cn(
                            "w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-300 relative group overflow-hidden mb-1",
                            isActive
                                ? `${colors.text} bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]`
                                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
                        )}
                        data-testid={`nav-item-${item.id}`}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={!isSidebarOpen ? item.label : undefined}
                    >
                        {/* Active Indicator Pillar */}
                        {isActive && (
                            <motion.div
                                layoutId="active-pill"
                                className="absolute left-0 w-1 h-2/3 rounded-r-full"
                                style={{ backgroundColor: 'var(--dept-color)' }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}

                        {/* Interactive Glow Backlight */}
                        <div
                            className={cn(
                                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                                isActive ? "opacity-5" : ""
                            )}
                            style={{
                                background: `radial-gradient(circle at 12px, var(--dept-color)33, transparent 50px)`
                            }}
                        />

                        <item.icon
                            size={18}
                            className={cn(
                                "relative z-10 transition-transform duration-300 group-hover:scale-110",
                                isActive ? "drop-shadow-[0_0_8px_var(--dept-color)]" : "opacity-70 group-hover:opacity-100"
                            )}
                        />

                        {isSidebarOpen && (
                            <span className={cn(
                                "truncate relative z-10 font-medium transition-all duration-300",
                                isActive ? "translate-x-1" : "group-hover:translate-x-0.5"
                            )}>
                                {item.label}
                            </span>
                        )}

                        {/* Particle Shine Effect on Active */}
                        {isActive && (
                            <motion.div
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-12"
                            />
                        )}
                    </button>
                </TooltipTrigger>
                {!isSidebarOpen && (
                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 font-medium">
                        {item.label}
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
});


export default function Sidebar() {
    const { t } = useTranslation();
    const { isThrottled } = usePowerState();
    // Select specific state slices with shallow comparison to prevent unnecessary re-renders on unrelated store updates
    const { currentModule, setModule, isSidebarOpen, toggleSidebar, userProfile, updatePreferences, logout } = useStore(
        useShallow((state) => ({
            currentModule: state.currentModule,
            setModule: state.setModule,
            isSidebarOpen: state.isSidebarOpen,
            toggleSidebar: state.toggleSidebar,
            userProfile: state.userProfile,
            updatePreferences: state.updatePreferences,
            logout: state.logout,
        }))
    );

    // Navigation throttle to prevent rapid-fire module switching (Firestore b815 crash fix)
    const lastNavTimeRef = useRef(0);
    const throttledSetModule = useCallback((moduleId: ModuleId) => {
        const now = Date.now();
        if (now - lastNavTimeRef.current < NAV_DEBOUNCE_MS) return;
        lastNavTimeRef.current = now;
        setModule(moduleId);
    }, [setModule]);

    // Grouped navigation items based on the screenshot
    const managerItems: SidebarItem[] = [
        { id: 'brand', icon: Briefcase, label: 'Brand Manager' },
        { id: 'road', icon: Users, label: 'Road Manager' },
        { id: 'campaign', icon: Megaphone, label: 'Campaign Manager' },
        { id: 'agent', icon: Network, label: 'Booking Agent' },
        { id: 'publicist', icon: Mic, label: 'Publicist' },
        { id: 'creative', icon: Palette, label: 'Creative Director' },
        { id: 'video', icon: Film, label: 'Video Producer' },
    ];

    const departmentItems: SidebarItem[] = [
        { id: 'marketing', icon: Megaphone, label: 'Marketing Department' }, // Duplicate icon, maybe different in real app
        { id: 'social', icon: Network, label: 'Social Media Department' },
        { id: 'legal', icon: Scale, label: 'Legal Department' },
        { id: 'publishing', icon: Book, label: 'Publishing Department' },
        { id: 'finance', icon: DollarSign, label: 'Finance Department' },
        { id: 'distribution', icon: Music, label: 'Distribution Department' },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems: SidebarItem[] = [
        { id: 'merch', icon: ShoppingBag, label: 'Merch Tool' },
        { id: 'audio-analyzer', icon: Radio, label: 'Audio Analyzer' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
        { id: 'knowledge', icon: Book, label: 'Knowledge Base' },
        { id: 'memory', icon: AudioLines, label: 'Memory Agent' },
        { id: 'history', icon: Clock, label: 'History' },
    ];

    // Pre-launch feature gating — filter out modules that are behind disabled flags
    const gatedModules = useGatedModules();
    const visibleManagerItems = managerItems.filter(item => !gatedModules.has(item.id));
    const visibleDepartmentItems = departmentItems.filter(item => !gatedModules.has(item.id));
    const visibleToolItems = toolItems.filter(item => !gatedModules.has(item.id));

    return (
        <motion.nav
            aria-label="Main navigation"
            animate={{ width: isSidebarOpen ? 280 : 80 }}
            transition={{
                type: isThrottled ? 'tween' : 'spring',
                stiffness: isThrottled ? 0 : 300,
                damping: 30,
                duration: isThrottled ? 0.2 : 0.4
            }}
            className={cn(
                "hidden md:flex h-full flex-col flex-shrink-0 relative z-20",
                "bg-[#0d1117]/60 backdrop-blur-2xl border-r border-white/5",
                "transition-colors duration-500 overflow-y-auto custom-scrollbar shadow-2xl"
            )}
        >

            {/* Header */}
            <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                {isSidebarOpen && (
                    <div className="overflow-hidden">
                        <h2 className="text-sm font-semibold text-gray-200 whitespace-nowrap">Studio Resources</h2>
                        <button
                            onClick={() => throttledSetModule('dashboard')}
                            className="flex items-center gap-2 text-xs text-gray-400 mt-1 hover:text-white transition-colors"
                            data-testid="return-hq-btn"
                            aria-label="Return to HQ"
                        >
                            <Layout size={12} /> Return to HQ
                        </button>
                    </div>
                )}
                <button
                    onClick={toggleSidebar}
                    data-testid="sidebar-toggle"
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    aria-label={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                    {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>

            {/* CMD+K Global Search Trigger */}
            {isSidebarOpen ? (
                <div className="px-4 pt-4 pb-2">
                    <button
                        onClick={() => useStore.getState().setCommandMenuOpen(true)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-black/20 hover:bg-white/5 border border-white/5 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-all group shadow-sm"
                        aria-label="Open Command Menu"
                    >
                        <span className="flex items-center gap-2">
                            <Search size={14} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
                            Search...
                        </span>
                        <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-[1px] bg-white/5 border border-white/10 rounded text-[10px] font-mono whitespace-nowrap shadow-sm text-gray-500 group-hover:text-gray-300">⌘</kbd>
                            <kbd className="px-1.5 py-[1px] bg-white/5 border border-white/10 rounded text-[10px] font-mono whitespace-nowrap shadow-sm text-gray-500 group-hover:text-gray-300">K</kbd>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-center pt-4 pb-2 border-b border-white/5 border-dashed">
                    <button
                        onClick={() => useStore.getState().setCommandMenuOpen(true)}
                        className="p-2 rounded-lg text-gray-400 hover:text-purple-400 hover:bg-white/10 transition-colors shadow-sm"
                        aria-label="Open Command Menu"
                        title="Search (⌘K)"
                    >
                        <Search size={16} />
                    </button>
                </div>
            )}

            {/* Founders Round — Primary Sales CTA */}
            <div className={`px-4 pb-2 ${isSidebarOpen ? 'pt-2' : 'pt-4 border-b border-white/5 border-dashed'}`}>
                <button
                    onClick={() => throttledSetModule('founders-checkout')}
                    className={cn(
                        "w-full flex items-center justify-center p-2.5 rounded-xl transition-all group relative overflow-hidden",
                        currentModule === 'founders-checkout'
                            ? "bg-amber-500/20 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                            : "bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/30 hover:border-amber-500/60 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]",
                        isSidebarOpen ? "gap-3" : ""
                    )}
                    aria-label="Back the Vision — Invest"
                    title={!isSidebarOpen ? "Back the Vision" : undefined}
                >
                    {/* Pulsing glow ring */}
                    <div className="absolute inset-0 rounded-xl border border-amber-500/20 animate-pulse pointer-events-none" />

                    <Gem size={16} className={cn(
                        "transition-all relative z-10",
                        currentModule === 'founders-checkout'
                            ? "text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                            : "text-amber-400 group-hover:text-amber-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                    )} />
                    {isSidebarOpen ? (
                        <span className={cn(
                            "text-sm font-bold tracking-wide transition-colors relative z-10",
                            currentModule === 'founders-checkout' ? "text-amber-200" : "text-amber-300/90 group-hover:text-amber-200"
                        )}>
                            Back the Vision
                        </span>
                    ) : (
                        <span className="text-[8px] font-black text-amber-400/70 uppercase tracking-widest absolute -bottom-0.5">
                        </span>
                    )}

                    {/* Shimmer sweep */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-amber-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                </button>
            </div>

            <div className="flex-1 py-4 space-y-6">
                {/* Manager's Office */}
                <div data-testid="manager-section">
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 whitespace-nowrap">Manager's Office</h3>}
                    <div className="space-y-0.5">
                        {visibleManagerItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} isSidebarOpen={isSidebarOpen} onNavigate={throttledSetModule} />
                        ))}
                    </div>
                </div>

                {/* Departments */}
                <div>
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 whitespace-nowrap">Departments</h3>}
                    <div className="space-y-0.5">
                        {visibleDepartmentItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} isSidebarOpen={isSidebarOpen} onNavigate={throttledSetModule} />
                        ))}
                    </div>
                </div>

                {/* Tools */}
                <div>
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 whitespace-nowrap">Tools</h3>}
                    <div className="space-y-0.5">
                        {visibleToolItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} isSidebarOpen={isSidebarOpen} onNavigate={throttledSetModule} />
                        ))}
                    </div>
                </div>
            </div>
            {/* User Profile Section */}
            <div className={`p-4 border-t border-white/5 mt-auto flex flex-col gap-2 ${!isSidebarOpen ? 'items-center' : ''}`}>
                {!isSidebarOpen && (
                    <div className="mb-2 w-full flex flex-col gap-2">
                    </div>
                )}
                <div className={`flex ${!isSidebarOpen ? 'flex-col justify-center' : 'items-center'} gap-3`}>

                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-dept-creative to-dept-marketing flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {userProfile?.photoURL ? (
                            <img src={userProfile.photoURL} alt="User avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs font-bold text-white">
                                {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'S'}
                            </span>
                        )}
                    </div>
                    {isSidebarOpen && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">
                                {userProfile?.bio || 'Creative Director'}
                            </p>
                            <p className="text-xs text-gray-500 truncate" data-testid="user-profile-info">
                                System Active
                            </p>
                        </div>
                    )}
                    <button
                        onClick={() => logout()}
                        className={`p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 transition-colors ${!isSidebarOpen ? 'mt-1' : ''}`}
                        title="Reload System"
                        aria-label="Reload System"
                        data-testid="logout-btn"
                    >
                        <LogOut size={14} />
                    </button>
                </div>

                {/* Theme Selector & Actions */}
                <div className={`mt-4 flex flex-col gap-2 rounded-lg bg-black/20 ${isSidebarOpen ? 'p-2 border border-white/5' : 'py-2 gap-3'}`}>
                    <div className="flex items-center justify-center">
                        <ThemeToggle isMinimized={!isSidebarOpen} />
                    </div>
                    <div className={`pt-2 border-t border-white/5 ${isSidebarOpen ? 'px-2' : 'px-1'}`}>
                        <BiometricToggle isMinimized={!isSidebarOpen} />
                    </div>

                    <div className={`pt-2 border-t border-white/5 flex ${isSidebarOpen ? 'items-center justify-center gap-3' : 'flex-col items-center gap-3'}`}>
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            const isEnabled = userProfile?.preferences?.observabilityEnabled ?? false;
                                            updatePreferences({ observabilityEnabled: !isEnabled });
                                            setModule('observability');
                                        }}
                                        className={`p-1.5 rounded transition-transform hover:scale-110 ${userProfile?.preferences?.observabilityEnabled ? 'text-dept-licensing bg-white/5 shadow-[0_0_10px_rgba(0,150,136,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        aria-label="System Observability"
                                        data-testid="observability-footer-btn"
                                    >
                                        {isSidebarOpen ? (
                                            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
                                                <Activity size={14} /> Observability
                                            </span>
                                        ) : (
                                            <Activity size={16} />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                {!isSidebarOpen && (
                                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 font-medium">
                                        System Observability
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => throttledSetModule('settings')}
                                        className={`p-1.5 rounded transition-transform hover:scale-110 ${currentModule === 'settings' ? 'text-cyan-400 bg-white/5 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        aria-label="Settings"
                                        data-testid="settings-footer-btn"
                                    >
                                        {isSidebarOpen ? (
                                            <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
                                                <Settings size={14} /> Settings
                                            </span>
                                        ) : (
                                            <Settings size={16} />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                {!isSidebarOpen && (
                                    <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-white/10 font-medium">
                                        Settings
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {isSidebarOpen && (
                    <p className="mt-4 text-[10px] text-gray-600 text-center italic">
                        made by Detroit, for the world.
                    </p>
                )}
            </div>
        </motion.nav>
    );
};
