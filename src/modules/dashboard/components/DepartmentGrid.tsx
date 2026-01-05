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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept, index) => (
                <motion.div
                    key={dept.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(dept.path)}
                    className="group relative bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 cursor-pointer hover:border-white/20 transition-all hover:bg-black/60 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
                >
                    {/* Hover Gradient Background */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-br ${dept.color} transition-opacity duration-500`} />

                    <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${dept.color} bg-opacity-10 text-white shadow-lg`}>
                            <dept.icon size={24} />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-stone-200 transition-colors">
                        {dept.name}
                    </h3>
                    <p className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors">
                        {dept.description}
                    </p>

                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <span className="text-xs font-mono text-gray-400">OPEN &rarr;</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
