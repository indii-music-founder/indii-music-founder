import React from 'react';
import { Sparkles, Film, Music, Megaphone, Book, GitBranch } from 'lucide-react';
import { useStore } from '@/core/store';
import { getColorForModule } from '@/core/theme/moduleColors';
import type { ModuleId } from '@/core/constants';

interface ModuleAction {
    id: ModuleId;
    name: string;
    icon: React.ElementType;
    description: string;
}

/**
 * Quick Actions - Department-themed module cards
 * Colors are derived from the central department color system (index.css)
 */
const MODULES: ModuleAction[] = [
    {
        id: 'creative',
        name: 'Creative Studio',
        icon: Sparkles,
        description: 'Generate images and videos',
    },
    {
        id: 'video',
        name: 'Video Production',
        icon: Film,
        description: 'AI-powered video workflow',
    },
    {
        id: 'marketing',
        name: 'Marketing',
        icon: Megaphone,
        description: 'Campaigns and brand management',
    },
    {
        id: 'publishing',
        name: 'Publishing',
        icon: Book,
        description: 'Distribution and royalties',
    },
    {
        id: 'workflow',
        name: 'Workflow Lab',
        icon: GitBranch,
        description: 'Automate AI tasks',
    }
];

export default function QuickActions() {
    const setModule = useStore((state) => state.setModule);

    return (
        <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Quick Launch</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {MODULES.map((module) => {
                    const Icon = module.icon;
                    const colors = getColorForModule(module.id);

                    return (
                        <button
                            key={module.id}
                            onClick={() => setModule(module.id)}
                            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
                            className={`
                                flex items-center gap-3
                                bg-[#161b22]/80 backdrop-blur-md border border-white/5 rounded-lg p-3 text-left
                                transition-all hover:bg-[#1c2128] hover:shadow-lg hover:-translate-y-0.5
                                group border-l-2 border-l-transparent hover:border-l-[--dept-color]
                            `}
                        >
                            <div className={`
                                w-8 h-8 rounded-md flex items-center justify-center
                                ${colors.bg} bg-opacity-20
                            `}>
                                <Icon className={colors.text} size={16} />
                            </div>
                            <span className="text-gray-300 font-medium text-xs group-hover:text-white truncate">
                                {module.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
