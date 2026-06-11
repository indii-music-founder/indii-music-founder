import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';

export default function CostWarningModal() {
    const pendingCostWarning = useStore((state) => state.pendingCostWarning);
    const setPendingCostWarning = useStore((state) => state.setPendingCostWarning);

    if (!pendingCostWarning) return null;

    const handleConfirm = () => {
        pendingCostWarning.resolve(true);
        setPendingCostWarning(null);
    };

    const handleCancel = () => {
        pendingCostWarning.resolve(false);
        setPendingCostWarning(null);
    };

    const isUnsavedChanges = pendingCostWarning.estimatedCost === 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="w-full max-w-md bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-yellow-500/20 rounded-xl shrink-0">
                                <AlertTriangle className="w-8 h-8 text-yellow-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    {isUnsavedChanges ? 'Unsaved Changes' : 'High Cost Operation'}
                                </h2>
                                <p className="text-sm text-zinc-400">
                                    {isUnsavedChanges ? 'Navigate Away?' : 'Confirmation Required'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-zinc-800/50 rounded-xl border border-white/5 mb-6">
                            {!isUnsavedChanges && (
                                <div className="flex items-center gap-2 text-red-400 mb-2">
                                    <DollarSign size={18} />
                                    <span className="font-mono text-lg font-bold">
                                        {pendingCostWarning.estimatedCost.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <p className="text-sm text-zinc-300 leading-relaxed">
                                {pendingCostWarning.reason}
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button 
                                variant="outline" 
                                onClick={handleCancel}
                                className="border-white/10 hover:bg-white/5"
                            >
                                {isUnsavedChanges ? 'Stay' : 'Cancel'}
                            </Button>
                            <Button 
                                onClick={handleConfirm}
                                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                            >
                                {isUnsavedChanges ? 'Leave Page' : 'Approve & Proceed'}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
