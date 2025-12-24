import React from 'react';
import { useStore } from '@/core/store';
import { Layout, Music, MessageSquare, Scale, Workflow, Home, Book } from 'lucide-react';

export const MobileNav = () => {
    const { currentModule, setModule } = useStore();

    const navItems = [
        { id: 'dashboard', icon: Home, label: 'Home' },
        { id: 'creative', icon: Layout, label: 'Studio' },
        { id: 'music', icon: Music, label: 'Analysis' },
        { id: 'marketing', icon: MessageSquare, label: 'Market' },
        { id: 'workflow', icon: Workflow, label: 'Flow' },
        { id: 'knowledge', icon: Book, label: 'Brain' },
    ] as const;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-white/10 z-50 pb-safe">
            <div className="flex justify-around items-center p-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setModule(item.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${currentModule === item.id
                            ? 'text-neon-blue'
                            : 'text-white/40 hover:text-white'
                            }`}
                    >
                        <item.icon size={20} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
