import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ModeSelector from '@/components/studio/ModeSelector';
import AgentWorkspace from './components/AgentWorkspace';
import DepartmentGrid from './components/DepartmentGrid';
import ReferenceImageManager from './components/ReferenceImageManager';
import AnalyticsView from './components/AnalyticsView';
import TripStarter from './components/TripStarter';

import { StudioLayout } from './components/StudioLayout';

export default function Dashboard() {
    const [viewMode, setViewMode] = useState<'agent' | 'studio'>('studio');


    if (viewMode === 'studio') {
        return (
            <StudioLayout>
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-1 h-8 bg-white/20 rounded-full" />
                            <h1 className="text-4xl font-bold text-white tracking-tight font-display">STUDIO HQ</h1>
                        </div>
                        <p className="text-gray-400 text-xs font-mono uppercase tracking-widest pl-4">Command Center // IndiiJS Alpha</p>
                    </div>
                    <ModeSelector mode={viewMode} onChange={setViewMode} />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-12"
                >
                    <section>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3 font-mono">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            Departments
                        </h2>
                        <DepartmentGrid />
                    </section>

                    <section>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3 font-mono">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                            Start a Trip
                        </h2>
                        <TripStarter />
                    </section>

                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3 font-mono">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                Reference Assets
                            </h2>
                            <ReferenceImageManager />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3 font-mono">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                Quick Analytics
                            </h2>
                            <AnalyticsView />
                        </div>
                    </section>
                </motion.div>
            </StudioLayout>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d1117] p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-white">Agent Workspace</h1>
                    <ModeSelector mode={viewMode} onChange={setViewMode} />
                </div>

                <motion.div
                    key="agent-view"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                >
                    <AgentWorkspace />
                </motion.div>
            </div>
        </div>
    );
}
