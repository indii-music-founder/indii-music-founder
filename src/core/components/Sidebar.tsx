import React from 'react';
import { useStore } from '../store';
import { Palette, Scale, Music, Megaphone, Layout, Network, Film, Book, Briefcase, Users, Radio, PenTool, DollarSign, FileText, Mic } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule } = useStore();

    // Grouped navigation items based on the screenshot
    const managerItems = [
        { id: 'brand', icon: Briefcase, label: 'Brand Manager' },
        { id: 'road', icon: Users, label: 'Road Manager' },
        { id: 'campaign', icon: Megaphone, label: 'Campaign Manager' },
        { id: 'publicist', icon: Mic, label: 'Publicist' },
    ];

    const departmentItems = [
        { id: 'creative', icon: Palette, label: 'Art Department' },
        { id: 'video', icon: Film, label: 'Video Department' },
        { id: 'marketing', icon: Megaphone, label: 'Marketing Department' }, // Duplicate icon, maybe different in real app
        { id: 'social', icon: Network, label: 'Social Media Department' },
        { id: 'legal', icon: Scale, label: 'Legal Department' },
        { id: 'publishing', icon: Book, label: 'Publishing Department' },
        { id: 'finance', icon: DollarSign, label: 'Finance Department' },
        { id: 'licensing', icon: FileText, label: 'Licensing Department' },
    ];

    const toolItems = [
        { id: 'music', icon: Radio, label: 'Audio Analyzer' },
        { id: 'creative', icon: Palette, label: 'Image Studio' },
        { id: 'video', icon: Film, label: 'Video Studio' },
        { id: 'workflow', icon: Network, label: 'Workflow Builder' },
    ];

    const NavItem = ({ item, isActive }: { item: any, isActive: boolean }) => (
        <button
            onClick={() => setModule(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${isActive
                ? 'text-teal-400 bg-teal-400/10 border-r-2 border-teal-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
        >
            <item.icon size={16} />
            <span className="truncate">{item.label}</span>
        </button>
    );

    return (
        <div className="w-64 h-full bg-[#0d1117] border-r border-white/5 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="p-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-gray-200">Studio Resources</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Select an analyzed track to automatically provide its creative brief as context for your next task.
                </p>
            </div>

            <div className="flex-1 py-4 space-y-6">
                {/* Manager's Office */}
                <div>
                    <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manager's Office</h3>
                    <div className="space-y-0.5">
                        {managerItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} />
                        ))}
                    </div>
                </div>

                {/* Departments */}
                <div>
                    <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Departments</h3>
                    <div className="space-y-0.5">
                        {departmentItems.map(item => (
                            <NavItem key={item.id} item={item} isActive={currentModule === item.id} />
                        ))}
                    </div>
                </div>

                {/* Tools */}
                <div>
                    <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tools</h3>
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
