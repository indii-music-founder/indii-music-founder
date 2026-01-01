import React from 'react';
import { useStore } from '../store';
import { getColorForModule } from '../theme/moduleColors';
import { type ModuleId } from '@/core/constants';
import { Palette, Scale, Music, Megaphone, Layout, Network, Film, Book, Briefcase, Users, Radio, PenTool, DollarSign, FileText, Mic, ChevronLeft, ChevronRight, Globe, LogOut, Shirt, ShoppingBag } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule, isSidebarOpen, toggleSidebar, userProfile, logout, setTheme } = useStore();

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
        { id: 'agent', icon: Network, label: 'Agent Tools' },
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
        { id: 'showroom', label: 'Banana Studio', icon: Shirt },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems: SidebarItem[] = [
        { id: 'audio-analyzer', icon: Radio, label: 'Audio Analyzer' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
        { id: 'knowledge', icon: Book, label: 'Knowledge Base' },
        { id: 'banana-preview', icon: Palette, label: 'Banana Preview' },
    ];

    const NavItem = ({ item, isActive }: { item: SidebarItem, isActive: boolean }) => {
        const colors = getColorForModule(item.id);

        return (
            <button
                onClick={() => setModule(item.id)}
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
                title={!isSidebarOpen ? item.label : ''}
            >
                <item.icon size={16} className={isActive ? 'drop-shadow-[0_0_4px_var(--dept-color)]' : ''} />
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
        );
    };

    return (
        <div className={`${isSidebarOpen ? 'w-64' : 'w-16'} h-full bg-[#0d1117] border-r border-white/5 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar transition-all duration-300 z-sidebar`}>
            {/* Header */}
            <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                {isSidebarOpen && (
                    <div className="overflow-hidden">
                        <h2 className="text-sm font-semibold text-gray-200 whitespace-nowrap">Studio Resources</h2>
                        <button
                            onClick={() => setModule('dashboard')}
                            className="flex items-center gap-2 text-xs text-gray-500 mt-1 hover:text-white transition-colors"
                        >
                            <Layout size={12} /> Return to HQ
                        </button>
                    </div>
                )}
                <button
                    onClick={toggleSidebar}
                    className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                >
                    {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>

            <div className="flex-1 py-4 space-y-6">
                {/* Manager's Office */}
                <div>
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
            <div className="p-4 border-t border-white/5 mt-auto">
                <div className={`flex ${!isSidebarOpen ? 'flex-col justify-center' : 'items-center'} gap-3`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">
                            S
                        </span>
                    </div>
                    {isSidebarOpen && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">
                                {userProfile?.bio || 'Creative Director'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                System Active
                            </p>
                        </div>
                    )}
                    <button
                        onClick={() => logout()}
                        className={`p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 transition-colors ${!isSidebarOpen ? 'mt-1' : ''}`}
                        title="Reload System"
                    >
                        <LogOut size={14} />
                    </button>
                </div>

                {/* Theme Selector */}
                {isSidebarOpen && (
                    <div className="mt-4 flex items-center justify-around bg-black/20 p-2 rounded-lg border border-white/5">
                        <button
                            onClick={() => setTheme('dark')}
                            className={`p-1.5 rounded transition-transform hover:scale-110 ${userProfile?.preferences?.theme === 'dark' || !userProfile?.preferences?.theme ? 'text-indigo-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                            title="Dark Mode"
                        >
                            <Palette size={14} />
                        </button>
                        <button
                            onClick={() => setTheme('banana')}
                            className={`p-1.5 rounded transition-transform hover:scale-110 ${userProfile?.preferences?.theme === 'banana' ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-200'}`}
                            title="Banana Mode"
                        >
                            <ShoppingBag size={14} />
                        </button>
                        <button
                            onClick={() => setTheme('banana-pro')}
                            className={`p-1.5 rounded transition-transform hover:scale-110 ${userProfile?.preferences?.theme === 'banana-pro' ? 'text-yellow-500 bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'text-gray-500 hover:text-yellow-400'}`}
                            title="Banana Pro"
                        >
                            <Scale size={14} />
                        </button>
                    </div>
                )}

                {isSidebarOpen && (
                    <p className="mt-4 text-[10px] text-gray-600 text-center italic">
                        made by Detroit, for the world.
                    </p>
                )}
            </div>
        </div>
    );
};
