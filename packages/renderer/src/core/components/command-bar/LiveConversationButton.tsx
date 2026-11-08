import React, { useCallback } from 'react';
import { AudioLines, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { liveConversationService, type LiveConversationStartOptions } from '@/services/intelligence/LiveConversationService';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { resolveAgentVoice } from '@/services/agent/AgentVoiceRegistry';
import { cn } from '@/lib/utils';

export interface LiveConversationButtonProps {
    sizeVariant?: 'default' | 'docked' | 'mobile';
    disabled?: boolean;
    targetAgentId?: string | null;
    startOptions?: LiveConversationStartOptions;
    className?: string;
}

const EMPTY_VOICE_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({});

export const LiveConversationButton = React.forwardRef<HTMLButtonElement, LiveConversationButtonProps>(({
    sizeVariant = 'default',
    disabled = false,
    targetAgentId,
    startOptions,
    className,
}, ref) => {
    const storeSlice = useStore(useShallow((state) => ({
        isLiveActive: state?.isLiveConversationActive ?? false,
        phase: state?.liveConversationPhase ?? 'idle',
        speakingAgentId: state?.activeSpeakingAgentId ?? null,
        directTargetAgentId: state?.directTargetAgentId ?? null,
        activeDepartmentId: state?.activeDepartmentId ?? null,
        agentVoiceOverrides: state?.agentVoiceOverrides ?? EMPTY_VOICE_OVERRIDES,
    })));

    const effectiveAgentId =
        storeSlice.speakingAgentId ||
        targetAgentId ||
        storeSlice.directTargetAgentId ||
        storeSlice.activeDepartmentId ||
        'generalist';

    const identity = resolveAgentVisualIdentity(effectiveAgentId);
    const voiceName = resolveAgentVoice(effectiveAgentId, storeSlice.agentVoiceOverrides);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (disabled) return;
        if (storeSlice.isLiveActive) {
            void liveConversationService.handlePrimaryAction();
        } else {
            void liveConversationService.startSession(startOptions);
        }
    }, [disabled, storeSlice.isLiveActive, startOptions]);

    const sizeClasses = sizeVariant === 'docked'
        ? 'size-8 rounded-full'
        : sizeVariant === 'mobile'
            ? 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl'
            : 'h-9 px-3.5 gap-1.5 rounded-full text-xs';

    const iconSize = sizeVariant === 'docked' ? 15 : 17;

    const buttonTitle = storeSlice.isLiveActive
        ? storeSlice.phase === 'speaking'
            ? `Speaking (${identity.displayName})… click to interrupt`
            : 'Listening… (click to end)'
        : 'Start two-way conversation';

    const ariaLabel = storeSlice.isLiveActive
        ? storeSlice.phase === 'speaking'
            ? `Interrupt ${identity.displayName} (${voiceName})`
            : 'End Two-Way Conversation'
        : 'Two-Way Conversation';

    return (
        <button
            ref={ref}
            type="button"
            onClick={handleClick}
            disabled={disabled}
            title={buttonTitle}
            data-testid="live-conversation-button"
            data-active={storeSlice.isLiveActive ? 'true' : 'false'}
            data-phase={storeSlice.phase}
            aria-label={ariaLabel}
            aria-pressed={storeSlice.isLiveActive}
            style={storeSlice.isLiveActive ? {
                backgroundColor: identity.accent,
                color: identity.onAccentForeground,
                boxShadow: `0 0 22px ${identity.glow}`,
                borderColor: identity.border,
            } : undefined}
            className={cn(
                'relative flex items-center justify-center font-bold transition-all duration-300 border cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                sizeClasses,
                storeSlice.isLiveActive
                    ? 'scale-[1.03]'
                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.18)]',
                storeSlice.isLiveActive && storeSlice.phase === 'listening' && 'animate-pulse',
                disabled && 'opacity-40 cursor-not-allowed',
                className
            )}
        >
            <span className="relative flex items-center justify-center">
                <AudioLines
                    size={iconSize}
                    className={cn(
                        'transition-transform duration-300',
                        storeSlice.isLiveActive && storeSlice.phase === 'speaking' && 'scale-110'
                    )}
                />
                <Sparkles
                    size={8}
                    className="absolute -top-1 -right-1.5 fill-current"
                />
            </span>
            {sizeVariant === 'default' && (
                <span className="tracking-tight">
                    {storeSlice.isLiveActive
                        ? storeSlice.phase === 'speaking'
                            ? identity.initials
                            : storeSlice.phase === 'thinking'
                                ? 'Thinking'
                                : 'Live'
                        : 'Live'}
                </span>
            )}
        </button>
    );
});

LiveConversationButton.displayName = 'LiveConversationButton';
export default LiveConversationButton;
