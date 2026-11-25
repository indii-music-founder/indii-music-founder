import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { livingPlanService, LivingPlan } from '@/services/agent/LivingPlanService';
import { X, Layers } from 'lucide-react';
import { PlanCard } from '@/core/components/chat/PlanCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { getColorForModule } from '@/core/theme/moduleColors';
import { logger } from '@/utils/logger';
import { toMillisSafe } from '@/utils/timestamps';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

const LIVING_PLANS_SUBSCRIPTION_LIMIT = 20;

interface LivingPlansTrackerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LivingPlansTracker({ isOpen, onClose }: LivingPlansTrackerProps) {
    const dialogRef = useModalAccessibility(isOpen, onClose);
    const currentProjectId = useStore(state => state.currentProjectId);
    const subscriptionKey = isOpen && currentProjectId ? currentProjectId : '';
    const [plansState, setPlansState] = useState<{ key: string; plans: LivingPlan[] }>({
        key: '',
        plans: [],
    });
    const [actingPlanId, setActingPlanId] = useState<string | null>(null);
    const actingPlanRef = useRef<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        if (!subscriptionKey) return;

        let isMounted = true;
        const unsubscribe = livingPlanService.subscribePlansForProject(
            subscriptionKey,
            (data) => {
                if (!isMounted) return;
                const sorted = [...data].sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
                setPlansState({ key: subscriptionKey, plans: sorted });
            },
            (err) => {
                logger.error('Failed to load living plans:', err);
                if (isMounted) {
                    setPlansState({ key: subscriptionKey, plans: [] });
                }
            },
            LIVING_PLANS_SUBSCRIPTION_LIMIT
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [subscriptionKey]);

    const loading = Boolean(subscriptionKey && plansState.key !== subscriptionKey);
    const plans = subscriptionKey && plansState.key === subscriptionKey ? plansState.plans : [];

    const handleApprove = async (planId: string) => {
        if (!currentProjectId || actingPlanRef.current === planId) return;
        actingPlanRef.current = planId;
        setActingPlanId(planId);
        try {
            await livingPlanService.approve(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            if (updated) {
                setPlansState(prev => ({
                    ...prev,
                    plans: prev.plans.map(p => p.id === planId ? updated : p),
                }));
            }
            toast.success('Plan approved! Strategy is now active.');

            // Resume the agent loop with the approved plan
            await agentService.resumeActivePlan(planId);
        } catch (e) {
            logger.error('Failed to approve plan:', e);
            toast.error('Failed to approve plan.');
        } finally {
            actingPlanRef.current = null;
            setActingPlanId(prev => (prev === planId ? null : prev));
        }
    };

    const handleRefine = () => {
        toast.info('Refinement mode active. Tell your agent what to change in the chat!');
        onClose(); // Close tracker to let them type
    };

    const handleCancel = async (planId: string) => {
        if (!currentProjectId || actingPlanRef.current === planId) return;
        const confirmed = await ConfirmDialog.call({
            title: 'Cancel Plan',
            message: 'Cancel this living plan? Active progress will stop.',
            confirmText: 'Cancel Plan',
            variant: 'destructive',
        });
        if (!confirmed) return;

        actingPlanRef.current = planId;
        setActingPlanId(planId);
        try {
            await livingPlanService.cancel(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            if (updated) {
                setPlansState(prev => ({
                    ...prev,
                    plans: prev.plans.map(p => p.id === planId ? updated : p),
                }));
            }
            toast.info('Plan cancelled.');
        } catch (e) {
            logger.error('Failed to cancel plan:', e);
            toast.error('Failed to cancel plan.');
        } finally {
            actingPlanRef.current = null;
            setActingPlanId(prev => (prev === planId ? null : prev));
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
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Living Plans"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 bottom-0 w-[450px] max-w-full bg-[#0a0a0e] border-l border-white/10 z-[100001] flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-2">
                                <Layers className={getColorForModule('agent').text} size={18} />
                                <h2 className="text-base font-bold tracking-tight text-gray-100">Living Plans</h2>
                            </div>
                            <button type="button" aria-label="Close living plans" onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <div className={`w-6 h-6 border-2 ${getColorForModule('agent').border.replace('/20', '').replace('/30', '')} border-t-transparent rounded-full animate-spin`} />
                                </div>
                            ) : plans.length === 0 ? (
                                <div className="text-center p-8 text-white/40">
                                    <Layers className="mx-auto mb-4 opacity-20" size={20} />
                                    <p className="text-xs font-medium text-gray-300">No living plans found.</p>
                                    <p className="text-xs mt-2 opacity-80">Ask indii Conductor to propose a strategy or plan for your project.</p>
                                </div>
                            ) : (
                                plans.map(plan => (
                                    <div key={plan.id} className="relative">
                                        {/* Background status indicator bar */}
                                        <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-md z-10 pointer-events-none ${
                                            plan.status === 'executing' ? 'bg-blue-500' :
                                            plan.status === 'completed' ? 'bg-emerald-500' :
                                            plan.status === 'drafting' || plan.status === 'proposed' ? getColorForModule('agent').bg.replace('/10', '') :
                                            'bg-gray-500'
                                        }`} />
                                        
                                        <PlanCard 
                                            plan={plan}
                                            onApprove={() => handleApprove(plan.id)}
                                            onRefine={handleRefine}
                                            onCancel={() => handleCancel(plan.id)}
                                            isLoading={actingPlanId === plan.id}
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
