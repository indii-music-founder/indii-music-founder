import React from 'react';
import { useStore } from '../store';
import { Palette, Scale, Music, Megaphone, Search, Settings, Layout, Network, Film } from 'lucide-react';

export default function Sidebar() {
    const { currentModule, setModule } = useStore();

    const navItems: { id: typeof currentModule; icon: any; label: string }[] = [
        { id: 'dashboard', icon: Layout, label: 'Dashboard' },
        { id: 'creative', icon: Palette, label: 'Studio' },
        { id: 'video', icon: Film, label: 'Video' },
        { id: 'music', icon: Music, label: 'Music' },
        { id: 'workflow', icon: Network, label: 'Workflow' },
        { id: 'marketing', icon: Megaphone, label: 'Marketing' },
        { id: 'legal', icon: Scale, label: 'Legal' },
    ];

    return (
        <div className="md:w-16 md:min-w-[4rem] w-full h-16 md:h-full glass-panel border-t md:border-t-0 md:border-r border-white/5 flex md:flex-col flex-row items-center py-2 md:py-4 z-50 flex-shrink-0 fixed bottom-0 md:relative justify-around md:justify-start">
            <div className="hidden md:block mb-8">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-purple to-neon-blue rounded-lg shadow-[0_0_15px_rgba(176,38,255,0.3)]"></div>
            </div>

            <div className="flex md:flex-col flex-row gap-1 md:gap-4 w-full items-center justify-around md:justify-center">
                {/* Command Bar Trigger */}
                <button
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                    className="hidden md:flex w-10 h-10 rounded-xl items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-all group relative"
                >
                    <Search size={20} />
                    <span className="absolute left-14 bg-black/90 border border-white/10 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none backdrop-blur-md">
                        Command (Cmd+K)
                    </span>
                </button>

                <div className="hidden md:block w-8 h-[1px] bg-white/10 my-2"></div>

                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setModule(item.id)}
                        className={`p-3 rounded-xl transition-all group relative flex justify-center ${currentModule === item.id
                            ? 'bg-neon-purple/20 text-neon-purple shadow-[0_0_10px_rgba(176,38,255,0.2)] border border-neon-purple/50'
                            : 'text-white/50 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <item.icon size={20} />

                        {/* Tooltip */}
                        <div className="hidden md:block absolute left-14 bg-black/90 border border-white/10 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 backdrop-blur-md">
                            {item.label}
                        </div>
                    </button>
                ))}
            </div>

            <div className="hidden md:block mt-auto">
                <button className="p-3 text-white/50 hover:text-white transition-colors">
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
}
