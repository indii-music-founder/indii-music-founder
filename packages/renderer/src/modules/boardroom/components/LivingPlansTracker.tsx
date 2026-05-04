import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { livingPlanService, LivingPlan } from '@/services/agent/LivingPlanService';
import { X, Layers } from 'lucide-react';
import { PlanCard } from '@/core/components/chat/PlanCard';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { logger } from '@/utils/logger';

interface LivingPlansTrackerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LivingPlansTracker({ isOpen, onClose }: LivingPlansTrackerProps) {
    const [plans, setPlans] = useState<LivingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const currentProjectId = useStore(state => state.currentProjectId);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen || !currentProjectId) {
            setTimeout(() => {
                setPlans([]);
                setLoading(false);
            }, 0);
            return;
        }
        
        let isMounted = true;
        setTimeout(() => {
            if (isMounted) {
                setLoading(true);
                setPlans([]);
            }
        }, 0);
        livingPlanService.getPlansForProject(currentProjectId).then(data => {
            if (isMounted) {
                // Sort by newest first
                setPlans(data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
                setLoading(false);
            }
        }).catch(err => {
            logger.error('Failed to load living plans:', err);
            if (isMounted) {
                setPlans([]);
                setLoading(false);
            }
        });

        return () => { isMounted = false; };
    }, [isOpen, currentProjectId]);

    const handleApprove = async (planId: string) => {
        if (!currentProjectId) return;
        try {
            await livingPlanService.approve(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            if (updated) {
                setPlans(prev => prev.map(p => p.id === planId ? updated : p));
            }
            toast.success('Plan approved! Strategy is now active.');
            
            // Resume the agent loop with the approved plan
            await agentService.resumeActivePlan(planId);
        } catch (e) {
            logger.error('Failed to approve plan:', e);
            toast.error('Failed to approve plan.');
        }
    };

    const handleRefine = () => {
        toast.info('Refinement mode active. Tell your agent what to change in the chat!');
        onClose(); // Close tracker to let them type
    };

    const handleCancel = async (planId: string) => {
        if (!currentProjectId) return;
        try {
            await livingPlanService.cancel(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            if (updated) {
                setPlans(prev => prev.map(p => p.id === planId ? updated : p));
            }
            toast.info('Plan cancelled.');
        } catch (e) {
            logger.error('Failed to cancel plan:', e);
            toast.error('Failed to cancel plan.');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000]"
                    />
                    
                    {/* Slide-over Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 bottom-0 w-[450px] max-w-full bg-[#0a0a0e] border-l border-white/10 z-[100001] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-2">
                                <Layers className="text-cyan-400" size={20} />
                                <h2 className="text-lg font-bold tracking-tight text-gray-100">Living Plans</h2>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loading ? (
                                <div className="flex justify-center p-12">
                                    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : plans.length === 0 ? (
                                <div className="text-center p-12 text-white/40">
                                    <Layers className="mx-auto mb-4 opacity-20" size={40} />
                                    <p className="text-sm font-medium text-gray-300">No living plans found.</p>
                                    <p className="text-xs mt-2">Ask indii Conductor to propose a strategy or plan for your project.</p>
                                </div>
                            ) : (
                                plans.map(plan => (
                                    <div key={plan.id} className="relative">
                                        {/* Background status indicator bar */}
                                        <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-md z-10 ${
                                            plan.status === 'executing' ? 'bg-blue-500' :
                                            plan.status === 'completed' ? 'bg-emerald-500' :
                                            plan.status === 'drafting' || plan.status === 'proposed' ? 'bg-cyan-500' :
                                            'bg-gray-500'
                                        }`} />
                                        
                                        <PlanCard 
                                            plan={plan}
                                            onApprove={() => handleApprove(plan.id)}
                                            onRefine={handleRefine}
                                            onCancel={() => handleCancel(plan.id)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
