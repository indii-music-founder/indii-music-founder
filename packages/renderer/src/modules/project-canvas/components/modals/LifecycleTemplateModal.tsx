/**
 * LifecycleTemplateModal.tsx
 *
 * Modal dialog for selecting and applying lifecycle templates to Project Canvas.
 */

import React, { useState } from 'react';
import { X, LayoutTemplate, Layers, ArrowRight, Sparkles, Check } from 'lucide-react';
import { useStore } from '@/core/store';
import { LifecycleTemplateService } from '../../services/LifecycleTemplateService';

interface LifecycleTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TemplateOption = 'full_lifecycle' | 'single_drop';

export const LifecycleTemplateModal: React.FC<LifecycleTemplateModalProps> = ({
    isOpen,
    onClose,
}) => {
    const addCanvasBlock = useStore((state) => state.addCanvasBlock);
    const addCanvasEdge = useStore((state) => state.addCanvasEdge);

    const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption>('full_lifecycle');

    if (!isOpen) return null;

    const handleApply = () => {
        const result =
            selectedTemplate === 'full_lifecycle'
                ? LifecycleTemplateService.generateFullLifecycleTemplate(100, 100)
                : LifecycleTemplateService.generateSingleDropTemplate(100, 100);

        const createdBlockIds: string[] = [];

        // 1. Create frames
        for (const blockConfig of result.blocks) {
            const blockId = addCanvasBlock(blockConfig);
            createdBlockIds.push(blockId);
        }

        // 2. Create sequence edges between stages
        for (const edgeConfig of result.edges) {
            const srcId = createdBlockIds[edgeConfig.sourceIndex];
            const targetId = createdBlockIds[edgeConfig.targetIndex];
            if (srcId && targetId) {
                addCanvasEdge(srcId, targetId, edgeConfig.relationship, edgeConfig.label);
            }
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                role="dialog"
                aria-label="Lifecycle Templates"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                            <LayoutTemplate size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">Project Canvas Lifecycle Templates</h2>
                            <p className="text-xs text-zinc-400">
                                Apply an organizational layout to shape your music project across standard release stages.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Template Card 1 */}
                    <div
                        onClick={() => setSelectedTemplate('full_lifecycle')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                            selectedTemplate === 'full_lifecycle'
                                ? 'bg-purple-950/20 border-purple-500/50 ring-1 ring-purple-500/30'
                                : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                        }`}
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-100">
                                    Full 8-Stage Lifecycle Journey
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-medium">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Complete journey across all 8 indii.music stages:
                                Create → Prepare → Register → Deliver → Release → Track → Operate → Repeat.
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono pt-1">
                                <Layers size={12} /> 8 Organizational Stage Frames &amp; Sequence Links
                            </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                            selectedTemplate === 'full_lifecycle'
                                ? 'border-purple-500 bg-purple-500 text-black'
                                : 'border-zinc-700'
                        }`}>
                            {selectedTemplate === 'full_lifecycle' && <Check size={12} />}
                        </div>
                    </div>

                    {/* Template Card 2 */}
                    <div
                        onClick={() => setSelectedTemplate('single_drop')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                            selectedTemplate === 'single_drop'
                                ? 'bg-purple-950/20 border-purple-500/50 ring-1 ring-purple-500/30'
                                : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700'
                        }`}
                    >
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-100">
                                    Fast-Track Single Drop
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Compact 4-stage pipeline for single releases:
                                Create → Prepare → Deliver → Release.
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono pt-1">
                                <Layers size={12} /> 4 Organizational Stage Frames
                            </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                            selectedTemplate === 'single_drop'
                                ? 'border-purple-500 bg-purple-500 text-black'
                                : 'border-zinc-700'
                        }`}>
                            {selectedTemplate === 'single_drop' && <Check size={12} />}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Sparkles size={12} className="text-purple-400" />
                        Templates provide spatial guidance and never execute automation.
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition-all"
                        >
                            <span>Apply Template</span>
                            <ArrowRight size={13} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
