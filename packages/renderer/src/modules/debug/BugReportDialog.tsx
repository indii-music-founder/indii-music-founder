import React, { useState, useCallback } from 'react';
import { AlertCircle, MessageSquare, Lightbulb, X } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { agentService } from '@/services/agent/AgentService';
import { logger } from '@/utils/logger';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export type BugReportType = 'bug' | 'feature';

export interface BugReportDialogState {
    isOpen: boolean;
    type: BugReportType;
    prefilledError?: string;
    prefilledModule?: string;
}

/**
 * BugReportDialog
 *
 * User-facing modal for reporting bugs and requesting features.
 * Integrates with agent system to send reports as messages.
 */
export const BugReportDialog: React.FC = () => {
    // ISSUE-CI-REGRESSION: a raw object-literal selector (no useShallow) forced
    // this ALWAYS-MOUNTED component to re-render on every Zustand store
    // change app-wide — the root cause of the production "Maximum update
    // depth exceeded" crash (React error #185) breaking e2e/deploy.
    const { bugReportDialog, setBugReportDialog } = useStore(
        useShallow((state) => ({
            bugReportDialog: state.bugReportDialog,
            setBugReportDialog: state.setBugReportDialog,
        }))
    );

    const [formData, setFormData] = useState({
        title: bugReportDialog?.prefilledError || '',
        description: bugReportDialog?.prefilledError ? `Error: ${bugReportDialog.prefilledError}` : '',
        stepsToRepro: bugReportDialog?.prefilledModule ? `Module: ${bugReportDialog.prefilledModule}` : '',
        expectedBehavior: '',
        actualBehavior: '',
        severity: 'major' as 'critical' | 'major' | 'minor' | 'cosmetic',
        useCase: '',
        priority: 'nice-to-have' as 'nice-to-have' | 'important' | 'critical',
        category: 'other' as 'ux' | 'performance' | 'integration' | 'content' | 'other',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const isBug = bugReportDialog?.type === 'bug';
    const isOpen = bugReportDialog?.isOpen ?? false;

    const handleClose = useCallback(() => {
        setBugReportDialog({ isOpen: false, type: 'bug' });
        setFormData({
            title: '',
            description: '',
            stepsToRepro: '',
            expectedBehavior: '',
            actualBehavior: '',
            severity: 'major',
            useCase: '',
            priority: 'nice-to-have',
            category: 'other',
        });
        setFeedback(null);
    }, [setBugReportDialog]);

    const handleSubmit = useCallback(async () => {
        if (!formData.title.trim() || !formData.description.trim()) {
            setFeedback({ type: 'error', message: 'Title and description are required.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const { agentRegistry } = await import('@/services/agent/registry');
            const { useStore: useStoreFresh } = await import('@/core/store');

            const state = useStoreFresh.getState();
            const directAgent = state.directTargetAgentId ? agentRegistry.get(state.directTargetAgentId) : null;
            const currentAgent = directAgent || agentRegistry.get('coordinator') || agentRegistry.get('generalist');

            if (!currentAgent) {
                setFeedback({ type: 'error', message: 'No agent available. Please open an agent first.' });
                setIsSubmitting(false);
                return;
            }

            // Format message for agent
            const reportMessage = isBug
                ? `🐛 **User Bug Report**\n\n**Title:** ${formData.title}\n**Severity:** ${formData.severity}\n\n**Description:** ${formData.description}\n\n**Steps to Reproduce:**\n${formData.stepsToRepro || 'Not provided'}\n\n**Expected Behavior:** ${formData.expectedBehavior || 'Not provided'}\n\n**Actual Behavior:** ${formData.actualBehavior || 'Not provided'}`
                : `💡 **User Feature Request**\n\n**Title:** ${formData.title}\n**Priority:** ${formData.priority}\n**Category:** ${formData.category}\n\n**Description:** ${formData.description}\n\n**Use Case:** ${formData.useCase || 'Not provided'}`;

            logger.info('[BugReportDialog] Sending report to agent', {
                type: isBug ? 'bug' : 'feature',
                title: formData.title,
                agentId: currentAgent.id,
            });

            // Send as message to active agent
            await agentService.sendMessage(reportMessage, undefined, currentAgent.id);

            const agentName = (currentAgent as any).displayName || currentAgent.id;
            setFeedback({
                type: 'success',
                message: isBug
                    ? `Bug report "${formData.title}" sent to ${agentName}`
                    : `Feature request "${formData.title}" sent to ${agentName}`,
            });

            // Clear form after 2 seconds
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (error) {
            logger.error('[BugReportDialog] Failed to send report:', error);
            setFeedback({
                type: 'error',
                message: `Failed to send report: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [formData, isBug, handleClose]);

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={handleClose}
            />
            <Modal isOpen={isOpen} onClose={handleClose} titleId="bug-report-title" className="max-w-2xl">
                <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isBug ? (
                            <>
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <h2 id="bug-report-title" className="text-lg font-bold">Report a Bug</h2>
                            </>
                        ) : (
                            <>
                                <Lightbulb className="w-5 h-5 text-yellow-500" />
                                <h2 id="bug-report-title" className="text-lg font-bold">Request a Feature</h2>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isBug
                        ? 'Help us fix issues by describing what went wrong'
                        : 'Share ideas for new features or improvements'}
                </p>

                <div className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="text-sm font-medium">
                            {isBug ? 'What broke?' : 'Feature title'}
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={isBug ? 'e.g., Image generation crashes on mobile' : 'e.g., Add dark mode toggle'}
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-sm font-medium">
                            Description
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <textarea
                            placeholder={isBug ? 'Describe the issue in detail' : 'Describe the feature or improvement'}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-md text-sm h-24"
                        />
                    </div>

                    {isBug ? (
                        <>
                            {/* Steps to Reproduce */}
                            <div>
                                <label className="text-sm font-medium">Steps to Reproduce</label>
                                <textarea
                                    placeholder="1. Click X\n2. Enter Y\n3. Click Z"
                                    value={formData.stepsToRepro}
                                    onChange={(e) => setFormData({ ...formData, stepsToRepro: e.target.value })}
                                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm h-20"
                                />
                            </div>

                            {/* Expected vs Actual */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Expected Behavior</label>
                                    <textarea
                                        placeholder="What should happen?"
                                        value={formData.expectedBehavior}
                                        onChange={(e) =>
                                            setFormData({ ...formData, expectedBehavior: e.target.value })
                                        }
                                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm h-20"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Actual Behavior</label>
                                    <textarea
                                        placeholder="What actually happened?"
                                        value={formData.actualBehavior}
                                        onChange={(e) =>
                                            setFormData({ ...formData, actualBehavior: e.target.value })
                                        }
                                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm h-20"
                                    />
                                </div>
                            </div>

                            {/* Severity */}
                            <div>
                                <label className="text-sm font-medium">Severity</label>
                                <select
                                    value={formData.severity}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            severity: e.target.value as 'critical' | 'major' | 'minor' | 'cosmetic',
                                        })
                                    }
                                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                                >
                                    <option value="critical">🔴 Critical (blocks usage)</option>
                                    <option value="major">🟠 Major (significant impact)</option>
                                    <option value="minor">🟡 Minor (works around)</option>
                                    <option value="cosmetic">🔵 Cosmetic (visual only)</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Use Case */}
                            <div>
                                <label className="text-sm font-medium">Use Case</label>
                                <textarea
                                    placeholder="How would you use this feature? What problem does it solve?"
                                    value={formData.useCase}
                                    onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm h-20"
                                />
                            </div>

                            {/* Priority & Category */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                priority: e.target.value as 'nice-to-have' | 'important' | 'critical',
                                            })
                                        }
                                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                                    >
                                        <option value="nice-to-have">Nice to have</option>
                                        <option value="important">Important</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                category: e.target.value as
                                                    | 'ux'
                                                    | 'performance'
                                                    | 'integration'
                                                    | 'content'
                                                    | 'other',
                                            })
                                        }
                                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                                    >
                                        <option value="ux">UX / Interface</option>
                                        <option value="performance">Performance</option>
                                        <option value="integration">Integration</option>
                                        <option value="content">Content</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Feedback Message */}
                    {feedback && (
                        <div
                            className={cn(
                                'p-3 rounded-md text-sm',
                                feedback.type === 'success'
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                            )}
                        >
                            {feedback.message}
                        </div>
                    )}
                </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm rounded border hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                            className="px-4 py-2 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            {isSubmitting ? 'Sending...' : 'Send to Agent'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
