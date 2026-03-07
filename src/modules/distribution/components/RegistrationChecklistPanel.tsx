import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, AlertCircle, FileAudio, Image as ImageIcon, AlignLeft, Hash, Users, Receipt, ChevronDown, ChevronUp, Radio } from 'lucide-react';

const CHECKLIST_ITEMS = [
    { id: 'audio', label: 'Audio Master (16-bit/44.1kHz+)', icon: FileAudio, status: 'complete', required: true },
    { id: 'art', label: 'Cover Art (3000x3000px)', icon: ImageIcon, status: 'complete', required: true },
    { id: 'metadata', label: 'Title & Release Metadata', icon: AlignLeft, status: 'complete', required: true },
    { id: 'isrc', label: 'ISRC Assignment', icon: Hash, status: 'missing', required: true, actionText: 'Generate ISRC' },
    { id: 'upc', label: 'UPC/EAN Code', icon: Receipt, status: 'missing', required: true, actionText: 'Assign UPC' },
    { id: 'splits', label: 'Contributor Splits', icon: Users, status: 'warning', required: false, actionText: 'Review Splits' },
];

export function RegistrationChecklistPanel() {
    const [expanded, setExpanded] = useState(true);

    const completeCount = CHECKLIST_ITEMS.filter(item => item.status === 'complete').length;
    const totalRequired = CHECKLIST_ITEMS.filter(item => item.required).length;
    const requiredComplete = CHECKLIST_ITEMS.filter(item => item.status === 'complete' && item.required).length;

    const progress = Math.round((requiredComplete / totalRequired) * 100);
    const isReadyForDistribution = progress === 100;

    return (
        <div className="rounded-xl border border-white/5 bg-black/40 backdrop-blur-md overflow-hidden flex flex-col">
            {/* Header / Summary */}
            <div
                className="p-3 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Registration Checklist</h3>
                </div>
                <div className="flex items-center gap-2">
                    {isReadyForDistribution ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                            <Radio size={10} className="animate-pulse" /> Ready
                        </div>
                    ) : (
                        <span className="text-xs font-bold text-white">
                            {progress}%
                        </span>
                    )}
                    {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
            </div>

            {/* Progress Bar (Visible even when collapsed) */}
            <div className="h-0.5 w-full bg-white/5 relative">
                <motion.div
                    className={`absolute inset-y-0 left-0 ${isReadyForDistribution ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-dept-publishing'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Expandable Checklist Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 space-y-1.5">
                            {CHECKLIST_ITEMS.map((item) => (
                                <div
                                    key={item.id}
                                    className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${item.status === 'complete'
                                            ? 'bg-white/[0.02]'
                                            : item.status === 'warning'
                                                ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                                                : 'bg-dept-publishing/5 hover:bg-dept-publishing/10 cursor-pointer'
                                        }`}
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        {item.status === 'complete' ? (
                                            <CheckCircle2 size={16} className="text-green-500" />
                                        ) : item.status === 'warning' ? (
                                            <AlertCircle size={16} className="text-yellow-500" />
                                        ) : (
                                            <Circle size={16} className="text-dept-publishing" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <item.icon size={12} className={item.status === 'complete' ? 'text-gray-500' : 'text-gray-400'} />
                                            <p className={`text-xs font-semibold truncate ${item.status === 'complete' ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                {item.label}
                                            </p>
                                        </div>
                                        {item.actionText && item.status !== 'complete' && (
                                            <button className={`mt-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${item.status === 'warning'
                                                    ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                                                    : 'bg-dept-publishing/20 text-dept-publishing hover:bg-dept-publishing/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                                }`}>
                                                {item.actionText}
                                            </button>
                                        )}
                                        {!item.required && <p className="text-[9px] text-gray-500 uppercase mt-1">Optional</p>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {!isReadyForDistribution && (
                            <div className="p-3 bg-red-500/5 border-t border-red-500/10 flex items-start gap-2 text-xs text-red-400 font-medium">
                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                <p>Release cannot be deployed to DSPs until all required items are complete.</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
