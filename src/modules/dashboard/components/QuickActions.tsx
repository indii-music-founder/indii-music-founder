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
        id: 'music',
        name: 'Music Analysis',
        icon: Music,
        description: 'Analyze audio and extract features',
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
        <div className="mb-8">
            <h2 className="text-xl font-bold text-white tracking-tight mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((module) => {
                    const Icon = module.icon;
                    const colors = getColorForModule(module.id);

                    return (
                        <button
                            key={module.id}
                            onClick={() => setModule(module.id)}
                            style={{ '--dept-color': `var(${colors.cssVar})` } as React.CSSProperties}
                            className={`
                                bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-5 text-left
                                bolt-interactive dept-border-top
                                hover:border-[--dept-color]/50 hover:bg-[#1c2128]/70 group
                            `}
                        >
                            <div className={`
                                w-10 h-10 rounded-lg flex items-center justify-center mb-3
                                ${colors.bg} group-hover:scale-110 transition-transform
                            `}>
                                <Icon className={colors.text} size={20} />
                            </div>
                            <h3 className="text-white font-semibold text-sm mb-1">{module.name}</h3>
                            <p className="text-gray-500 text-xs leading-relaxed">{module.description}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
