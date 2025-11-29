import React from 'react';
import { useStore } from '../store';
import { Palette, Scale, Music, Megaphone, Settings } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule } = useStore();

    const navItems = [
        { id: 'creative', icon: Palette, label: 'Creative' },
        { id: 'legal', icon: Scale, label: 'Legal' },
        { id: 'music', icon: Music, label: 'Music' },
        { id: 'marketing', icon: Megaphone, label: 'Marketing' },
    ];

    return (
        <div className="w-16 min-w-[4rem] bg-[#0a0a0a] border-r border-gray-800 flex flex-col items-center py-4 z-50 flex-shrink-0">
            <div className="mb-8">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg"></div>
            </div>

            <div className="flex flex-col gap-4 w-full px-2">
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

                        {/* Tooltip */}
                        <div className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {item.label}
                        </div>
                    </button>
                ))}
            </div>

            <div className="mt-auto">
                <button className="p-3 text-gray-600 hover:text-gray-400">
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
}
