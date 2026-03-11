import React, { useState } from 'react';
import { motion } from 'motion/react';
import AgentWorkspace from './components/AgentWorkspace';
import { CustomDashboard } from './components/CustomDashboard';
import { LayoutDashboard, Bot } from 'lucide-react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

type DashboardTab = 'agent' | 'custom';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<DashboardTab>('agent');

    return (
        <ModuleErrorBoundary moduleName="Dashboard">
            {/* Tab Bar */}
            <div className="flex-shrink-0 border-b border-white/5 px-6 flex gap-6">
                {([
                    { id: 'agent', label: 'Agent Workspace', icon: Bot, activeClass: 'border-indigo-500 text-indigo-400' },
                    { id: 'custom', label: 'My Dashboard', icon: LayoutDashboard, activeClass: 'border-white text-white' },
                ] as const).map(({ id, label, icon: Icon, activeClass }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as DashboardTab)}
                        className={`flex items-center gap-2 h-12 text-xs font-bold border-b-2 transition-all ${activeTab === id
                            ? activeClass
                            : 'border-transparent text-muted-foreground hover:text-white'
                            }`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'agent' ? (
                    <div className="min-h-full bg-bg-dark p-8 overflow-y-auto w-full">
                        <div className="max-w-7xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            >
                                <AgentWorkspace />
                            </motion.div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto">
                        <CustomDashboard />
                    </div>
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
