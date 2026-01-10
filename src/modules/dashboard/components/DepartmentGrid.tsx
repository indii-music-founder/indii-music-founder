import React from 'react';
import { motion } from 'framer-motion';
import {
    Megaphone,
    Music,
    Video,
    BarChart3,
    Scale,
    Copyright,
    Share2,
    Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/core/store';
import { ModuleId } from '@/core/constants';

interface Department {
    id: ModuleId;
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
}

const DEPARTMENTS: Department[] = [
    {
        id: 'marketing',
        name: 'Marketing Dept.',
        description: 'Campaigns, social media & ads',
        icon: Megaphone,
        color: 'from-pink-500 to-rose-500',
    },
    {
        id: 'publishing',
        name: 'Publishing Dept.',
        description: 'Royalties, split sheets & PROs',
        icon: Copyright,
        color: 'from-blue-500 to-cyan-500',
    },
    {
        id: 'creative',
        name: 'Creative Studio',
        description: 'Cover art, video & assets',
        icon: Video,
        color: 'from-purple-500 to-violet-500',
    },
    {
        id: 'distribution',
        name: 'Distribution',
        description: 'Upload to DSPs & stores',
        icon: Share2,
        color: 'from-green-500 to-emerald-500',
    },
    {
        id: 'finance',
        name: 'Finance Office',
        description: 'Earnings & expenses',
        icon: Wallet,
        color: 'from-yellow-500 to-amber-500',
    },
    {
        id: 'legal',
        name: 'Legal Dept.',
        description: 'Contracts & agreements',
        icon: Scale,
        color: 'from-gray-500 to-slate-500',
    },
];

export default function DepartmentGrid() {
    const { setModule } = useStore();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept, index) => (
                <motion.button
                    key={dept.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setModule(dept.id)}
                    className="group relative bg-[#090b0e] border border-white/5 rounded-lg p-5 cursor-pointer hover:border-white/10 transition-all hover:bg-[#11161d] overflow-hidden flex items-center gap-4 text-left w-full"
                >
                    {/* Hover Glow */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-r ${dept.color} transition-opacity duration-300 blur-xl`} />

                    {/* Icon */}
                    <div className={`p-3 rounded-md bg-gradient-to-br ${dept.color} bg-opacity-10 text-white shadow-sm shrink-0 ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-300`}>
                        <dept.icon size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 z-10">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors truncate font-display tracking-tight">
                                {dept.name}
                            </h3>
                            <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 text-gray-500">
                                &rarr;
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 group-hover:text-gray-400 transition-colors truncate font-mono tracking-tight">
                            {dept.description}
                        </p>
                    </div>
                </motion.button>
            ))}
        </div>
    );
}
