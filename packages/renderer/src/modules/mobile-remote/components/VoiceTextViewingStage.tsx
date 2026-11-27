import React, { useRef } from 'react';
import { Mic, MicOff, Send, Loader2, Sparkles, X, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/modules/mobile-remote/haptics';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { LiveConversationButton } from '@/core/components/command-bar/LiveConversationButton';
import type { LiveConversationStartOptions } from '@/services/intelligence/LiveConversationService';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

export interface StageAttachment {
    url?: string;
    mimeType?: string;
    name?: string;
    base64?: string;
    size?: number;
}

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
    isUploading?: boolean;
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
    /** Staged media attachments */
    attachments?: StageAttachment[];
    /** Remove attachment callback */
    onRemoveAttachment?: (index: number) => void;
    /** Add attachment file callback */
    onAddAttachmentFile?: (file: File) => void;
    /** Optional live two-way conversation session options */
    startOptions?: LiveConversationStartOptions;
}

export default function VoiceTextViewingStage({
    value,
    onChange,
    onSubmit,
    placeholder = 'Broadcast to Boardroom…',
    isWaiting = false,
    isUploading = false,
    isPaired = true,
    isListening = false,
    onToggleListening,
    voiceSupported = true,
    targetLabel = 'Boardroom',
    onTargetClick,
    targetIcon,
    submitLabel = 'Send',
    className,
    attachments,
    onRemoveAttachment,
    onAddAttachmentFile,
    startOptions,
}: VoiceTextViewingStageProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { isLiveActive, activeSpeakingAgentId, directTargetAgentId, activeDepartmentId } = useStore(useShallow(state => ({
        isLiveActive: state?.isLiveConversationActive ?? false,
        activeSpeakingAgentId: state?.activeSpeakingAgentId ?? null,
        directTargetAgentId: state?.directTargetAgentId ?? null,
        activeDepartmentId: state?.activeDepartmentId ?? null,
    })));

    const effectiveAgentId = activeSpeakingAgentId || directTargetAgentId || activeDepartmentId || 'generalist';
    const activeIdentity = resolveAgentVisualIdentity(effectiveAgentId);

    const handleSend = () => {
        const hasContent = value.trim() || (attachments && attachments.length > 0);
        if (!hasContent || isWaiting || isUploading || !isPaired) return;
        triggerHaptic(40);
        onSubmit();
    };

    const handleClear = () => {
        triggerHaptic(25);
        onChange('');
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={cn('relative w-full z-30 font-sans', className)}>
            {/* ─── Single Unified Docked Composer ────────────────────────────── */}
            <div className="relative">
                {/* Ambient Faded Light Glow Aura */}
                <div
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none absolute -inset-2.5 rounded-[30px] transition-opacity duration-700 blur-2xl -z-10",
                        isLiveActive ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                        background: `radial-gradient(ellipse at 50% 50%, ${activeIdentity.glow} 0%, transparent 72%)`,
                    }}
                />
                <div className={cn(
                    "flex flex-col p-2 rounded-[26px] bg-[#1a1512]/90 border shadow-[0_16px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors",
                    isListening ? "border-red-500/35" : "border-white/10"
                )}>
                {/* Inline Dictation / Draft Status Strip (replaces separate stacked popup card) */}
                {(isListening || value.length > 80) && (
                    <div
                        data-testid="composer-inline-status"
                        className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-1.5 mb-1 border-b border-white/5 text-[11px]"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            {isListening && (
                                <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    Dictating
                                </span>
                            )}
                            <span className="text-stone-400 truncate">
                                to <strong className="text-stone-200 font-semibold">{targetLabel}</strong>
                            </span>
                        </div>
                        {value.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 shrink-0"
                                aria-label="Clear text"
                            >
                                <X className="w-3 h-3" />
                                <span>Clear</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Staged Attachment Chips */}
                {attachments && attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2 border-b border-white/5 mb-1.5">
                        {attachments.map((att, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl bg-white/10 border border-white/10 text-xs text-stone-200"
                            >
                                {att.url && (att.mimeType?.startsWith('image/') || att.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) ? (
                                    <img src={att.url} alt={att.name || 'Attachment'} className="w-5 h-5 rounded-md object-cover" />
                                ) : (
                                    <Paperclip className="w-3.5 h-3.5 text-stone-400" />
                                )}
                                <span className="max-w-[120px] truncate font-mono text-[11px]">{att.name || 'Attachment'}</span>
                                {onRemoveAttachment && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic(20);
                                            onRemoveAttachment(idx);
                                        }}
                                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 text-stone-400 hover:text-white transition-colors cursor-pointer"
                                        aria-label="Remove attachment"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2.5">
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
                            rows={Math.min(5, Math.max(1, value.split('\n').length))}
                            placeholder={isListening ? 'Listening… speak now' : placeholder}
                            disabled={isWaiting || !isPaired}
                            className="w-full bg-transparent border-none p-2 text-sm text-stone-100 placeholder:text-stone-500 focus:ring-0 focus:outline-none resize-none max-h-36 custom-scrollbar leading-snug"
                        />
                    </div>

                    {/* Action Buttons: Dictate, Attach & Send */}
                    <div className="flex items-center gap-1.5 shrink-0 pb-0.5 pr-0.5">
                        {onAddAttachmentFile && (
                            <>
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            onAddAttachmentFile(e.target.files[0]);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => fileInputRef.current?.click()}
                                    aria-label="Attach image"
                                    disabled={isWaiting || !isPaired}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-200 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all cursor-pointer"
                                    style={{ minWidth: '40px', minHeight: '40px' }}
                                >
                                    <Paperclip className="w-4 h-4" />
                                </motion.button>
                            </>
                        )}

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

                        {/* Two-Way Multimodal Conversation Button (Circular Waveform + Sparkle) */}
                        <LiveConversationButton
                            sizeVariant="mobile"
                            disabled={isWaiting || !isPaired}
                            startOptions={startOptions}
                        />

                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={handleSend}
                            disabled={(!value.trim() && (!attachments || attachments.length === 0)) || isWaiting || isUploading || !isPaired}
                            aria-label={`${submitLabel} message`}
                            className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer',
                                (value.trim() || (attachments && attachments.length > 0)) && !isWaiting && !isUploading && isPaired
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
            </div>
        </div>
    );
}
