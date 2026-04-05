import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { StorageQuotaService } from '@/services/StorageQuotaService';
import { Layers, HardDrive, MessageSquare, FolderOpen } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion-primitives/animated-number';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    suffix?: string;
    precision?: number;
    color: string;
    delay: number;
}

function StatCard({ icon, label, value, suffix = '', precision = 0, color, delay }: StatCardProps) {
    return (
        <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#161b22]/60 border border-white/5 hover:border-white/10 transition-colors min-w-0"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
        >
            <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider truncate">{label}</div>
                <div className="text-lg font-bold text-white leading-tight">
                    <AnimatedNumber value={value} precision={precision} />{suffix}
                </div>
            </div>
        </motion.div>
    );
}

export default function StatsRibbon() {
    const { projects, agentHistory } = useStore(
        useShallow((s) => ({
            projects: s.projects,
            agentHistory: s.agentHistory,
        }))
    );

    const [storagePercent, setStoragePercent] = useState(0);

    useEffect(() => {
        const unsubscribe = StorageQuotaService.subscribeToQuota((quota) => {
            if (quota) {
                setStoragePercent(quota.usedPercent);
            } else {
                setStoragePercent(0);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
                icon={<FolderOpen size={16} className="text-blue-400" />}
                label="Projects"
                value={projects.length}
                color="bg-blue-500/10"
                delay={0.05}
            />
            <StatCard
                icon={<HardDrive size={16} className="text-indigo-400" />}
                label="Storage Used"
                value={storagePercent}
                suffix="%"
                precision={1}
                color="bg-indigo-500/10"
                delay={0.1}
            />
            <StatCard
                icon={<MessageSquare size={16} className="text-purple-400" />}
                label="Messages"
                value={agentHistory.length}
                color="bg-purple-500/10"
                delay={0.15}
            />
            <StatCard
                icon={<Layers size={16} className="text-emerald-400" />}
                label="Departments"
                value={12}
                suffix=" active"
                color="bg-emerald-500/10"
                delay={0.2}
            />
        </div>
    );
}
