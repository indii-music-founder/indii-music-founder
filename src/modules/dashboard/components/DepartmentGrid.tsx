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

const DEPARTMENTS = [
    {
        id: 'marketing',
        name: 'Marketing Dept.',
        description: 'Campaigns, social media & ads',
        icon: Megaphone,
        color: 'from-pink-500 to-rose-500',
        path: '/marketing'
    },
    {
        id: 'publishing',
        name: 'Publishing Dept.',
        description: 'Royalties, split sheets & PROs',
        icon: Copyright,
        color: 'from-blue-500 to-cyan-500',
        path: '/publishing'
    },
    {
        id: 'creative',
        name: 'Creative Studio',
        description: 'Cover art, video & assets',
        icon: Video,
        color: 'from-purple-500 to-violet-500',
        path: '/showroom'
    },
    {
        id: 'distribution',
        name: 'Distribution',
        description: 'Upload to DSPs & stores',
        icon: Share2,
        color: 'from-green-500 to-emerald-500',
        path: '/distribution'
    },
    {
        id: 'finance',
        name: 'Finance Office',
        description: 'Earnings & expenses',
        icon: Wallet,
        color: 'from-yellow-500 to-amber-500',
        path: '/finance'
    },
    {
        id: 'legal',
        name: 'Legal Dept.',
        description: 'Contracts & agreements',
        icon: Scale,
        color: 'from-gray-500 to-slate-500',
        path: '/legal'
    },
    {
        id: 'analytics',
        name: 'Data Analytics',
        description: 'Cross-platform insights',
        icon: BarChart3,
        color: 'from-indigo-500 to-blue-600',
        path: '/analytics' // Assuming path
    },
    // Add more as needed
];

export default function DepartmentGrid() {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {DEPARTMENTS.map((dept, index) => (
                <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => navigate(dept.path)}
                    className="group relative bg-[#161b22]/80 backdrop-blur-md border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/20 transition-all hover:bg-[#1c2128] hover:shadow-lg overflow-hidden flex items-center gap-4"
                >
                    {/* Hover Gradient Background (Subtle) */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-r ${dept.color} transition-opacity duration-300`} />

                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${dept.color} bg-opacity-10 text-white shadow-sm shrink-0`}>
                        <dept.icon size={18} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors truncate">
                                {dept.name}
                            </h3>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 -mr-1">
                                &rarr;
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors truncate">
                            {dept.description}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
