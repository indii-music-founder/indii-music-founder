import React from 'react';
import { useStore } from '../store';
import { Palette, Scale, Music, Megaphone, Search, Settings, Layout, Film, Network } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule } = useStore();

    const navItems = [
        { id: 'dashboard', icon: Layout, label: 'Dashboard' },
        { id: 'creative', icon: Palette, label: 'Studio' },
        { id: 'music', icon: Music, label: 'Music' },
        { id: 'workflow', icon: Network, label: 'Workflow' },
        { id: 'marketing', icon: Megaphone, label: 'Marketing' },
        { id: 'legal', icon: Scale, label: 'Legal' },
    ];

    return (
        <div className="md:w-16 md:min-w-[4rem] w-full h-16 md:h-full bg-surface-panel border-t md:border-t-0 md:border-r border-gray-800 flex md:flex-col flex-row items-center py-2 md:py-4 z-50 flex-shrink-0 fixed bottom-0 md:relative justify-around md:justify-start">
            <div className="hidden md:block mb-8">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg"></div>
            </div>

            <div className="flex md:flex-col flex-row gap-1 md:gap-4 w-full items-center justify-around md:justify-center">
                {/* Command Bar Trigger - Hidden on mobile for space, or keep as icon */}
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                    className="hidden md:flex w-10 h-10 rounded-xl items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-all group relative"
                >
                    <Search size={20} />
                    <span className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                        Command (Cmd+K)
                    </span>
                </button>

                <div className="hidden md:block w-8 h-[1px] bg-gray-800 my-2"></div>

                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setModule(item.id as any)}
                        className={`p-3 rounded-xl transition-all group relative flex justify-center ${currentModule === item.id
                            ? 'bg-gray-800 text-white shadow-lg shadow-purple-900/20'
                            : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
                            }`}
                    >
                        <item.icon size={20} />

                        {/* Tooltip - Desktop only */}
                        <div className="hidden md:block absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {item.label}
                        </div>
                    </button>
                ))}
            </div>

            <div className="hidden md:block mt-auto">
                <button className="p-3 text-gray-600 hover:text-gray-400">
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
}
