import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';

export const AgentFeedbackWidget = () => {
    const { isFeedbackWidgetOpen, currentFeedbackContext, closeFeedbackWidget, submitFeedback } = useStore(
        useShallow((state) => ({
            isFeedbackWidgetOpen: state.isFeedbackWidgetOpen,
            currentFeedbackContext: state.currentFeedbackContext,
            closeFeedbackWidget: state.closeFeedbackWidget,
            submitFeedback: state.submitFeedback,
        }))
    );

    const [comment, setComment] = useState('');
    const [isCommenting, setIsCommenting] = useState(false);
    const [sharedGlobally, setSharedGlobally] = useState(false);

    if (!isFeedbackWidgetOpen || !currentFeedbackContext) return null;

    const handleRating = (rating: 'positive' | 'negative' | 'neutral') => {
        if (rating === 'negative' && !isCommenting) {
            // Force comment on negative feedback to extract a rule
            setIsCommenting(true);
            return;
        }
        submitFeedback('current-user', rating, comment, sharedGlobally);
        setComment('');
        setIsCommenting(false);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 right-6 w-96 bg-zinc-900 border border-zinc-800 shadow-2xl rounded-xl p-5 z-50"
            >
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            Agent Alignment
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                            Help steer {currentFeedbackContext.agentId} decisions.
                        </p>
                    </div>
                    <button onClick={closeFeedbackWidget} className="text-zinc-500 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 mb-4">
                    <p className="text-xs font-mono text-zinc-300 line-clamp-2">
                        Action: {currentFeedbackContext.actionType}<br />
                        {currentFeedbackContext.contentSummary}
                    </p>
                </div>

                {!isCommenting ? (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-400"
                            onClick={() => handleRating('positive')}
                        >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Good Direction
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                            onClick={() => handleRating('negative')}
                        >
                            <ThumbsDown className="w-4 h-4 mr-2" />
                            Correct Agent
                        </Button>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                        <Textarea
                            className="w-full text-sm bg-zinc-950 border-zinc-800 text-white min-h-[80px]"
                            placeholder="What should the agent learn from this? (e.g. 'I don't do sponsored posts')"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />

                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <input
                                type="checkbox"
                                id="wisdom-pool"
                                checked={sharedGlobally}
                                onChange={(e) => setSharedGlobally(e.target.checked)}
                                className="rounded border-zinc-700 bg-zinc-900"
                            />
                            <label htmlFor="wisdom-pool">Share anonymized rule to Wisdom Pool</label>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsCommenting(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button variant="default" size="sm" onClick={() => handleRating('negative')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                                <Check className="w-4 h-4 mr-2" />
                                Save Memory
                            </Button>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};
