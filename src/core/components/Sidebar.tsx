import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePowerState } from '@/core/hooks/usePowerState';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import { getColorForModule } from '../theme/moduleColors';
import { type ModuleId } from '@/core/constants';
import { Scale, Music, Megaphone, Layout, Network, Film, Book, Briefcase, Users, Radio, PenTool, DollarSign, FileText, Mic, ChevronLeft, ChevronRight, Globe, LogOut, Shirt, ShoppingBag, Activity, Clock, Palette, AudioLines, Volume2, Search, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/core/components/ui/ThemeToggle';
import { BiometricToggle } from '@/core/components/ui/BiometricToggle';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';


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

    interface SidebarItem {
        id: ModuleId;
        icon: React.ElementType;
        label: string;
    }

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

    const NavItem = ({ item, isActive }: { item: SidebarItem, isActive: boolean }) => {
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
                                setModule(item.id);
                            }}
                            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
                            className={`
                                w-full flex items-center gap-3 px-4 py-2 text-sm
                                bolt-interactive relative
                                ${isActive
                                    ? `${colors.text} ${colors.bg} border-l-2 border-l-[--dept-color]`
                                    : `text-gray-400 ${colors.hoverText} ${colors.hoverBg} border-l-2 border-l-transparent`
                                }
                                ${!isSidebarOpen ? 'justify-center px-2' : ''}
                            `}
                            data-testid={`nav-item-${item.id}`}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={!isSidebarOpen ? item.label : undefined}
                        >
                            <item.icon size={16} className={isActive ? 'drop-shadow-[0_0_4px_var(--dept-color)]' : ''} />
                            {isSidebarOpen && <span className="truncate">{item.label}</span>}
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
    };

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
                "hidden md:flex h-full bg-bg-dark border-r border-white/5 flex-col flex-shrink-0 overflow-y-auto custom-scrollbar z-sidebar"
            )}
        >
            {/* Header */}
            <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                {isSidebarOpen && (
                    <div className="overflow-hidden">
                        <h2 className="text-sm font-semibold text-gray-200 whitespace-nowrap">Studio Resources</h2>
                        <button
                            onClick={() => setModule('dashboard')}
                            className="flex items-center gap-2 text-xs text-gray-500 mt-1 hover:text-white transition-colors"
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

            <div className="flex-1 py-4 space-y-6">
                {/* Manager's Office */}
                <div data-testid="manager-section">
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Manager's Office</h3>}
                    <div className="space-y-0.5">
                        {managerItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} />
                        ))}
                    </div>
                </div>

                {/* Departments */}
                <div>
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Departments</h3>}
                    <div className="space-y-0.5">
                        {departmentItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} />
                        ))}
                    </div>
                </div>

                {/* Tools */}
                <div>
                    {isSidebarOpen && <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 whitespace-nowrap">Tools</h3>}
                    <div className="space-y-0.5">
                        {toolItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} />
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

                {/* Theme Selector */}
                {isSidebarOpen && (
                    <div className="mt-4 flex flex-col gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center justify-center">
                            <ThemeToggle />
                        </div>
                        <div className="px-2 pt-2 border-t border-white/5">
                            <BiometricToggle />
                        </div>
                        <div className="px-1 pt-2 border-t border-white/5 flex flex-col gap-2">
                        </div>


                        <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/5">
                            <button
                                onClick={() => {
                                    const isEnabled = userProfile?.preferences?.observabilityEnabled ?? false;
                                    updatePreferences({ observabilityEnabled: !isEnabled });
                                    setModule('observability');
                                }}
                                className={`p-1.5 rounded transition-transform hover:scale-110 ${userProfile?.preferences?.observabilityEnabled ? 'text-dept-licensing bg-white/5 shadow-[0_0_10px_rgba(0,150,136,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                title="System Observability"
                                aria-label="System Observability"
                                data-testid="observability-footer-btn"
                            >
                                <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
                                    <Activity size={14} /> Observability
                                </span>
                            </button>
                            <button
                                onClick={() => setModule('settings')}
                                className={`p-1.5 rounded transition-transform hover:scale-110 ${currentModule === 'settings' ? 'text-cyan-400 bg-white/5 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
                                title="Settings"
                                aria-label="Settings"
                                data-testid="settings-footer-btn"
                            >
                                <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
                                    <Settings size={14} /> Settings
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {isSidebarOpen && (
                    <p className="mt-4 text-[10px] text-gray-600 text-center italic">
                        made by Detroit, for the world.
                    </p>
                )}
            </div>
        </motion.nav>
    );
};
