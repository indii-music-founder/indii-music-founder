import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ModeSelector from '@/components/studio/ModeSelector';
import AgentWorkspace from './components/AgentWorkspace';
import DepartmentGrid from './components/DepartmentGrid';
import ReferenceImageManager from './components/ReferenceImageManager';
import AnalyticsView from './components/AnalyticsView';

export default function Dashboard() {
    const [viewMode, setViewMode] = useState<'agent' | 'studio'>('agent');

    return (
        <div className="min-h-screen bg-[#0d1117] p-8 overflow-y-auto">
            {/* Header Area */}
            <header className="mb-8 text-center">
                {/* Only show Title in Studio Mode, keep clean in Agent Mode or minimal */}
                {viewMode === 'studio' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Studio Headquarters</h1>
                        <p className="text-gray-400">Visual command center for all departments.</p>
                    </motion.div>
                )}
            </header>

            {/* Top Level Mode Switcher */}
            <ModeSelector mode={viewMode} onChange={setViewMode} />

            {/* Main Content Area with Transitions */}
            <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                    {viewMode === 'agent' ? (
                        <motion.div
                            key="agent-view"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <AgentWorkspace />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="studio-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-12"
                        >
                            <section>
                                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                    <span className="w-1 h-6 bg-blue-500 rounded-full" />
                                    Departments
                                </h2>
                                <DepartmentGrid />
                            </section>

                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                        <span className="w-1 h-6 bg-purple-500 rounded-full" />
                                        Reference Assets
                                    </h2>
                                    <ReferenceImageManager />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                        <span className="w-1 h-6 bg-green-500 rounded-full" />
                                        Quick Analytics
                                    </h2>
                                    <AnalyticsView />
                                </div>
                            </section>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
