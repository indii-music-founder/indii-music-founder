import React from 'react';
import { useStore } from '../store';
import { Palette, Scale, Music, Megaphone, Layout, Network, Film, Book, Briefcase, Users, Radio, PenTool, DollarSign, FileText, Mic, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule, isSidebarOpen, toggleSidebar } = useStore();

    // Grouped navigation items based on the screenshot
    const managerItems = [
        { id: 'brand', icon: Briefcase, label: 'Brand Manager' },
        { id: 'road', icon: Users, label: 'Road Manager' },
        { id: 'campaign', icon: Megaphone, label: 'Campaign Manager' },
        { id: 'publicist', icon: Mic, label: 'Publicist' },
    ];

    const departmentItems = [
        { id: 'marketing', icon: Megaphone, label: 'Marketing Department' }, // Duplicate icon, maybe different in real app
        { id: 'social', icon: Network, label: 'Social Media Department' },
        { id: 'legal', icon: Scale, label: 'Legal Department' },
        { id: 'publishing', icon: Book, label: 'Publishing Department' },
        { id: 'finance', icon: DollarSign, label: 'Finance Department' },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems = [
        { id: 'music', icon: Radio, label: 'Audio Analyzer' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
    ];

    const NavItem = ({ item, isActive }: { item: any, isActive: boolean }) => (
        <button
            onClick={() => setModule(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${isActive
                ? 'text-teal-400 bg-teal-400/10 border-r-2 border-teal-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                } ${!isSidebarOpen ? 'justify-center px-2' : ''}`}
            title={!isSidebarOpen ? item.label : ''}
        >
            <item.icon size={16} />
            {isSidebarOpen && <span className="truncate">{item.label}</span>}
        </button>
    );

    return (
        <div className={`${isSidebarOpen ? 'w-64' : 'w-16'} h-full bg-[#0d1117] border-r border-white/5 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar transition-all duration-300`}>
            {/* Header */}
            <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                {isSidebarOpen && (
                    <div className="overflow-hidden">
                        <h2 className="text-sm font-semibold text-gray-200 whitespace-nowrap">Studio Resources</h2>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed truncate">
                            Select an analyzed track...
                        </p>
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
        </div>
    );
}
