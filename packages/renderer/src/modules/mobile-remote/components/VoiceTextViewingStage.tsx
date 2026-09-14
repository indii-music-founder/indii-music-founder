import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2, Sparkles, X, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '../haptics';

export interface VoiceTextViewingStageProps {
    /** The current draft text value */
    value: string;
    /** Text change callback */
    onChange: (value: string) => void;
    /** Submit callback */
    onSubmit: () => void;
    /** Placeholder string when idle */
    placeholder?: string;
    /** Whether an operation is in-flight / waiting */
    isWaiting?: boolean;
    /** Whether the remote controller is paired with the studio */
    isPaired?: boolean;
    /** Voice dictation state from useVoice */
    isListening?: boolean;
    /** Toggle dictation callback */
    onToggleListening?: () => void;
    /** Whether voice dictation is supported in current browser */
    voiceSupported?: boolean;
    /** Current recipient label (e.g. "Boardroom", "Creative Agent") */
    targetLabel?: string;
    /** Optional selector toggle button (e.g. agent mode picker toggle) */
    onTargetClick?: () => void;
    /** Target icon or mode badge */
    targetIcon?: React.ReactNode;
    /** Custom submit label or title */
    submitLabel?: string;
    /** Additional CSS classes for root container */
    className?: string;
}

export default function VoiceTextViewingStage({
    value,
    onChange,
    onSubmit,
    placeholder = 'Broadcast to Boardroom…',
    isWaiting = false,
    isPaired = true,
    isListening = false,
    onToggleListening,
    voiceSupported = true,
    targetLabel = 'Boardroom',
    onTargetClick,
    targetIcon,
    submitLabel = 'Send',
    className,
}: VoiceTextViewingStageProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const viewingTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [isEditingInViewingStage, setIsEditingInViewingStage] = useState(false);
    const [isManualExpanded, setIsManualExpanded] = useState(false);

    // Dictation automatically opens the Viewing Stage
    const showViewingStage = isListening || isManualExpanded || (value.length > 80 && !isWaiting);

    // Auto-focus the viewing textarea if user clicks "Edit Text"
    useEffect(() => {
        if (isEditingInViewingStage && viewingTextareaRef.current) {
            viewingTextareaRef.current.focus();
        }
    }, [isEditingInViewingStage]);

    const handleSend = () => {
        if (!value.trim() || isWaiting || !isPaired) return;
        triggerHaptic(40);
        setIsEditingInViewingStage(false);
        setIsManualExpanded(false);
        onSubmit();
    };

    const handleClear = () => {
        triggerHaptic(25);
        onChange('');
        setIsEditingInViewingStage(false);
        setIsManualExpanded(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={cn('relative w-full z-30 font-sans', className)}>
            {/* ─── Expandable Live Viewing Stage ───────────────────────────────── */}
            <AnimatePresence>
                {showViewingStage && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="mb-3 overflow-hidden rounded-[26px] bg-[#1a1512]/95 border border-white/10 shadow-[0_24px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
                    >
                        {/* Stage Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                {isListening ? (
                                    <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25">
                                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                                            Live Dictation
                                        </span>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#00ff66]/15 border border-[#00ff66]/25">
                                        <Sparkles className="w-3 h-3 text-[#00ff66]" />
                                        <span className="text-[10px] font-bold text-[#00ff66] uppercase tracking-widest font-mono">
                                            Viewing Stage
                                        </span>
                                    </span>
                                )}
                                <span className="text-[11px] font-medium text-stone-400">
                                    to <strong className="text-white font-semibold">{targetLabel}</strong>
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-stone-500 mr-1">
                                    {value.length} chars
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic(20);
                                        setIsManualExpanded(!isManualExpanded);
                                    }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                    aria-label="Toggle stage view"
                                >
                                    {isManualExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-red-400 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                    aria-label="Clear text"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Viewing Area Body */}
                        <div className="p-5">
                            {isEditingInViewingStage ? (
                                <textarea
                                    ref={viewingTextareaRef}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={4}
                                    placeholder="Type your message here…"
                                    className="w-full bg-transparent border border-white/10 rounded-xl p-3 text-base text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#00ff66]/40 resize-none font-sans leading-relaxed custom-scrollbar"
                                />
                            ) : (
                                <div
                                    onClick={() => setIsEditingInViewingStage(true)}
                                    className="min-h-[72px] max-h-48 overflow-y-auto pr-1 text-base text-stone-100 font-sans leading-relaxed cursor-text select-text custom-scrollbar"
                                >
                                    {value ? (
                                        <span>
                                            {value}
                                            {isListening && (
                                                <span className="inline-block w-2 h-4 bg-[#00ff66] animate-pulse ml-1 align-middle rounded-xs" />
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-stone-500 italic text-sm">
                                            {isListening ? 'Listening… speak clearly into your phone' : 'Empty draft'}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Live Audio Waveform Visualizer */}
                            {isListening && (
                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-1.5 h-8">
                                    {[0.4, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.85, 0.65, 0.45, 0.75, 0.35, 0.8, 0.6, 0.95, 0.5, 0.7].map((h, idx) => (
                                        <motion.div
                                            key={idx}
                                            animate={{
                                                scaleY: [h * 0.3, h * 1.2, h * 0.4],
                                                opacity: [0.6, 1, 0.6],
                                            }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.6 + (idx % 4) * 0.15,
                                                ease: 'easeInOut',
                                                delay: idx * 0.04,
                                            }}
                                            className="w-1 rounded-full bg-linear-to-t from-amber-400 via-[#00ff66] to-[#12C6D4] h-7 origin-center"
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Stage Action Controls */}
                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic(20);
                                            setIsEditingInViewingStage(!isEditingInViewingStage);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-stone-300 border border-white/5 transition-colors cursor-pointer"
                                    >
                                        <Edit3 className="w-3.5 h-3.5 text-stone-400" />
                                        {isEditingInViewingStage ? 'Done Editing' : 'Edit Text'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClear}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleSend}
                                    disabled={!value.trim() || isWaiting || !isPaired}
                                    className={cn(
                                        'flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg',
                                        value.trim() && !isWaiting && isPaired
                                            ? 'bg-[#00ff66] text-[#061806] shadow-[#00ff66]/20 hover:bg-[#36D96F]'
                                            : 'bg-white/5 text-stone-500 cursor-not-allowed border border-white/5'
                                    )}
                                >
                                    {isWaiting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Sending</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            <span>{submitLabel}</span>
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Docked Input Bar ────────────────────────────────────────────── */}
            <div className="flex items-end gap-2.5 p-2 rounded-[26px] bg-[#1a1512]/90 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                {/* Target Mode / Agent Selector Button */}
                {onTargetClick && (
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                            triggerHaptic(30);
                            onTargetClick();
                        }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/[0.04] border border-white/10 text-stone-300 hover:text-white hover:bg-white/10 transition-all shrink-0 cursor-pointer"
                        aria-label={`Target: ${targetLabel}`}
                        style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                        {targetIcon || <Sparkles className="w-5 h-5 text-[#00ff66]" />}
                    </motion.button>
                )}

                {/* Text Area Entry */}
                <div className="flex-1 min-h-[44px] flex items-center px-1">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={Math.min(3, Math.max(1, value.split('\n').length))}
                        placeholder={isListening ? 'Listening… speak now' : placeholder}
                        disabled={isWaiting || !isPaired}
                        className="w-full bg-transparent border-none p-2 text-sm text-stone-100 placeholder:text-stone-500 focus:ring-0 focus:outline-none resize-none max-h-28 custom-scrollbar leading-snug"
                    />
                </div>

                {/* Action Buttons: Dictate & Send */}
                <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-0.5">
                    {voiceSupported && onToggleListening && (
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                                triggerHaptic(40);
                                onToggleListening();
                            }}
                            aria-label={isListening ? 'Stop dictation' : 'Start voice dictation'}
                            className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer',
                                isListening
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                                    : 'text-stone-400 hover:text-stone-200 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5'
                            )}
                            style={{ minWidth: '40px', minHeight: '40px' }}
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </motion.button>
                    )}

                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSend}
                        disabled={!value.trim() || isWaiting || !isPaired}
                        aria-label="Send message"
                        className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer',
                            value.trim() && !isWaiting && isPaired
                                ? 'bg-[#00ff66] text-[#061806] shadow-[#00ff66]/25 hover:bg-[#36D96F]'
                                : 'bg-white/5 text-stone-600 border border-white/5 cursor-not-allowed'
                        )}
                        style={{ minWidth: '40px', minHeight: '40px' }}
                    >
                        {isWaiting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </motion.button>
                </div>
            </div>
        </div>
    );
}
