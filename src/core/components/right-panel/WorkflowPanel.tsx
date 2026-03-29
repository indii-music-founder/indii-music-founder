import React from 'react';
import { Network, Play, Save, ChevronRight, Settings, Database, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';

interface WorkflowPanelProps {
    toggleRightPanel: () => void;
}

export default function WorkflowPanel({ toggleRightPanel }: WorkflowPanelProps) {
    const toast = useToast();

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-bg-dark to-bg-dark/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg">
                        <Network size={14} className="text-orange-400" />
                    </div>
                    Workflow Builder
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">EXECUTION</label>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toast.success("Workflow execution started")}
                        className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 border border-orange-400/20"
                    >
                        <Play size={16} />
                        Run Workflow
                    </motion.button>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">ACTIVE ENVIRONMENT</label>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Database size={14} /> Database</span>
                            <span className="text-xs text-green-400 font-mono">Connected</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Activity size={14} /> Execution Queue</span>
                            <span className="text-xs text-gray-300 font-mono">Idle</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">WORKFLOW SETTINGS</label>
                    <button className="w-full p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-2 text-sm text-gray-300 group-hover:text-white">
                            <Settings size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                            Global Parameters
                        </div>
                        <ChevronRight size={14} className="text-gray-600" />
                    </button>
                    <button className="w-full p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-2 text-sm text-gray-300 group-hover:text-white">
                            <Save size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                            Save as Template
                        </div>
                        <ChevronRight size={14} className="text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
}
