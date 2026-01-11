import React from 'react';
import { useStore } from '@/core/store';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';
import QuickActions from './QuickActions';
import { WorkspaceCanvas } from './WorkspaceCanvas';

// ... (existing imports)

export default function AgentWorkspace() {

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Area - Compact */}
            <div className="flex items-end justify-between px-2">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-xl font-bold text-white mb-1">Agent Workspace</h1>
                    <p className="text-xs text-stone-400">indii is ready to assist.</p>
                </motion.div>

                {/* Stats / Status Pill */}
                <div className="flex gap-3">
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 bg-[#161b22] px-3 py-1.5 rounded-full border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        System Active
                    </div>
                </div>
            </div>

            {/* Quick Actions Integration */}
            <QuickActions />

            {/* Main Chat/Input Area */}
            {/* Main Canvas Area */}
            <WorkspaceCanvas />

            {/* Context Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#161b22]/50">
                    <div className="p-2 rounded bg-green-500/10 text-green-500">
                        <CheckCircle size={14} />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-300">Last Completed</div>
                        <div className="text-[10px] text-gray-500">No recent tasks</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-[#161b22]/50">
                    <div className="p-2 rounded bg-amber-500/10 text-amber-500">
                        <AlertCircle size={14} />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-300">Active Context</div>
                        <div className="text-[10px] text-gray-500">Untitled Project • Default Brand Kit</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
