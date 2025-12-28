import React from 'react';
import { Sparkles, Film, Music, Megaphone, Book, GitBranch } from 'lucide-react';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/store/slices/appSlice';

interface ModuleAction {
    id: ModuleId;
    name: string;
    icon: React.ElementType;
    description: string;
    color: string;
    hoverBorder: string;
}

const MODULES: ModuleAction[] = [
    {
        id: 'creative',
        name: 'Creative Studio',
        icon: Sparkles,
        description: 'Generate images and videos',
        color: 'text-blue-400',
        hoverBorder: 'hover:border-blue-500/50'
    },
    {
        id: 'video',
        name: 'Video Production',
        icon: Film,
        description: 'AI-powered video workflow',
        color: 'text-green-400',
        hoverBorder: 'hover:border-green-500/50'
    },
    {
        id: 'music',
        name: 'Music Analysis',
        icon: Music,
        description: 'Analyze audio and extract features',
        color: 'text-purple-400',
        hoverBorder: 'hover:border-purple-500/50'
    },
    {
        id: 'marketing',
        name: 'Marketing',
        icon: Megaphone,
        description: 'Campaigns and brand management',
        color: 'text-orange-400',
        hoverBorder: 'hover:border-orange-500/50'
    },
    {
        id: 'publishing',
        name: 'Publishing',
        icon: Book,
        description: 'Distribution and royalties',
        color: 'text-pink-400',
        hoverBorder: 'hover:border-pink-500/50'
    },
    {
        id: 'workflow',
        name: 'Workflow Lab',
        icon: GitBranch,
        description: 'Automate AI tasks',
        color: 'text-cyan-400',
        hoverBorder: 'hover:border-cyan-500/50'
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
                    return (
                        <button
                            key={module.id}
                            onClick={() => setModule(module.id)}
                            className={`bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-5 text-left transition-all ${module.hoverBorder} hover:bg-[#1c2128]/70 group`}
                        >
                            <div className={`w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                <Icon className={module.color} size={20} />
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
