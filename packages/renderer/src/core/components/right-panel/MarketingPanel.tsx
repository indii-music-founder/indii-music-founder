import React, { useState } from 'react';
import { ChevronRight, Rocket, TrendingUp, CalendarClock } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { OrchestrationService } from '@/services/agent/OrchestrationService';

interface MarketingPanelProps {
    toggleRightPanel: () => void;
}

export default function MarketingPanel({ toggleRightPanel }: MarketingPanelProps) {
    const toast = useToast();
    const [isDeploying, setIsDeploying] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState('INDII_GROWTH_PROTOCOL');
    const [dailyBudget, setDailyBudget] = useState(10);
    const projectId = useStore(state => state.currentProjectId || 'default-project');
    const userProfile = useStore(state => state.userProfile);

    const handleDeploy = async () => {
        if (!userProfile?.id) {
            toast.error('Authentication required to deploy protocol');
            return;
        }

        setIsDeploying(true);
        try {
            const orchestrationService = new OrchestrationService();
            // Simulate the deployment by executing the workflow
            const context = {
                userId: userProfile.id,
                projectId: projectId,
                dailyBudget: dailyBudget
            };

            await orchestrationService.executeWorkflow(selectedTemplate, context);
            toast.success('indii Growth Protocol Depolyed! 28-Day algorithmic spike initiated.');

            // Auto close panel after success
            setTimeout(() => {
                toggleRightPanel();
            }, 1500);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to deploy protocol');
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#0a0a0f] to-[#050508]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <TrendingUp size={14} className="text-indigo-400" />
                    </div>
                    Marketing & Growth
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" aria-label="Close Panel">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

                {/* Protocol Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">CAMPAIGN TIMELINE</label>
                    <div className="relative">
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                        >
                            <option value="INDII_GROWTH_PROTOCOL">indii Growth Protocol (28-Day)</option>
                            <option value="CAMPAIGN_LAUNCH">Standard Release Campaign</option>
                            <option value="TOUR_PLANNING">Tour Announcement</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <CalendarClock size={16} />
                        </div>
                    </div>
                    {selectedTemplate === 'INDII_GROWTH_PROTOCOL' && (
                        <p className="text-xs text-gray-400 leading-relaxed mt-2 pl-1 border-l-2 border-indigo-500/50">
                            Front-loaded 28-day algorithmic spike. Generates 6-15 variations. Kills losers by Day 3.
                        </p>
                    )}
                </div>

                {/* Configuration */}
                {selectedTemplate === 'INDII_GROWTH_PROTOCOL' && (
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <label className="text-[10px] font-bold text-gray-500 tracking-wider">DAILY BUDGET (USD)</label>
                        <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={dailyBudget}
                                onChange={(e) => setDailyBudget(Number(e.target.value))}
                                className="flex-1 accent-indigo-500"
                            />
                            <span className="text-sm font-mono text-indigo-400 font-bold w-12 text-right">
                                ${dailyBudget}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                            <span>Placements: <span className="text-gray-300">Instagram-Only</span></span>
                            <span>KPI: <span className="text-gray-300">Cost-Per-Save</span></span>
                        </div>
                    </div>
                )}

                {/* Trigger Action */}
                <div className="pt-6">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isDeploying}
                        onClick={handleDeploy}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 border border-indigo-400/20"
                    >
                        {isDeploying ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                Deploying Protocol...
                            </>
                        ) : (
                            <>
                                <Rocket size={18} />
                                Deploy Protocol
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}
