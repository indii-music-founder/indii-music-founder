import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { voiceService } from '@/services/intelligence/VoiceService';
import { cn } from '@/lib/utils';

/**
 * TalkButton — the studio-talkback control for the chat overlay.
 *
 * One button, four faces:
 *   IDLE      → Mic. Click opens the talkback channel (continuous dictation).
 *   LISTENING → pulsing Mic; interim words stream into the input live.
 *               Click again = "release": stop the mic and hand the take to
 *               the caller to send. Esc cancels and reverts the take.
 *   BUSY      → the agent is working; shows the Stop face instead.
 *
 * The release never fires a half-edited thought: the parent disarms
 * auto-send the moment the user types over a live session (see
 * `isAutoSendArmed`), and a sub-300ms click is treated as jitter, not intent.
 */

export type TalkFace = 'idle' | 'listening' | 'busy';

export interface TalkReleaseResult {
    /** Base text + finalized transcript (+ interim tail) at the moment of release. */
    text: string;
    /** True when no manual edit disarmed auto-send during the session. */
    autoSend: boolean;
}

export interface TalkButtonProps {
    /** Current full input text — captured as the base when a session opens. */
    value: string;
    /** Agent is working → render the Stop face instead of the mic faces. */
    isAgentBusy?: boolean;
    /** Called when the Stop face is clicked (existing stopAgent behavior). */
    onStopAgent?: () => void;
    /** Live combined text (base + transcript so far) while listening. */
    onLiveText: (combined: string) => void;
    /** A dictation session actually opened (mic granted, engine running). */
    onSessionStart?: () => void;
    /** User released the talkback (second click). */
    onRelease: (result: TalkReleaseResult) => void;
    /** Recognition ended on its own (silence/timeout) without a release click. */
    onNaturalEnd: (finalText: string) => void;
    /** Mic permission or capture failure — parent owns user-facing toast. */
    onMicError: (error: unknown) => void;
    /** Parent tracks typing-during-listen; consulted at release time only. */
    isAutoSendArmed: () => boolean;
    disabled?: boolean;
    /** Color family for the idle face: indii green, or the neutral glass pill. */
    accent?: 'indii' | 'glass';
    sizeVariant?: 'default' | 'docked' | 'mobile';
    className?: string;
}

/** Minimum listen duration before a second click counts as an intentional release. */
const MIN_LISTEN_MS = 300;

export const combineTranscript = (base: string, final: string, interim: string): string => {
    const spoken = [final.trim(), interim.trim()].filter(Boolean).join(' ');
    const trimmedBase = base.trim();
    if (!spoken) return trimmedBase;
    return trimmedBase ? `${trimmedBase} ${spoken}` : spoken;
};

export const TalkButton = React.forwardRef<HTMLButtonElement, TalkButtonProps>(({
    value,
    isAgentBusy = false,
    onStopAgent,
    onLiveText,
    onSessionStart,
    onRelease,
    onNaturalEnd,
    onMicError,
    isAutoSendArmed,
    disabled = false,
    accent = 'glass',
    sizeVariant = 'default',
    className,
}, ref) => {
    const [isListening, setIsListening] = useState(false);
    const startedAtRef = useRef(0);
    const baseTextRef = useRef('');
    const finalRef = useRef('');
    const interimRef = useRef('');
    /** The handlers object passed to voiceService for THIS surface's session. */
    const handlersRef = useRef<Parameters<typeof voiceService.startDictation>[0] | null>(null);

    const face: TalkFace = isAgentBusy ? 'busy' : isListening ? 'listening' : 'idle';

    // Leaving the surface with an open talkback channel must never leak a live
    // mic — but only if this surface still OWNS the shared engine. An idle
    // TalkButton unmounting (panel hidden, overlay closed) must not kill the
    // session another surface is running.
    useEffect(() => {
        return () => {
            if (handlersRef.current) voiceService.stopDictationIfOwner(handlersRef.current);
        };
    }, []);

    // The agent going busy mid-listen (e.g. a response arrives from another
    // surface) must stand the mic down: the busy face has no release affordance,
    // and a live session with no visible owner is a silent hot mic. Only the
    // external system is touched here — React state settles through onEnd.
    useEffect(() => {
        if (isAgentBusy && isListening) {
            if (handlersRef.current) voiceService.stopDictationIfOwner(handlersRef.current);
            startedAtRef.current = 0;
            finalRef.current = '';
            interimRef.current = '';
            onLiveText(baseTextRef.current); // revert the draft take entirely
        }
    }, [isAgentBusy, isListening, onLiveText]);

    const endSession = useCallback(() => {
        setIsListening(false);
        finalRef.current = '';
        interimRef.current = '';
    }, []);

    const handleCancel = useCallback(() => {
        if (handlersRef.current) voiceService.stopDictationIfOwner(handlersRef.current);
        startedAtRef.current = 0;
        onLiveText(baseTextRef.current); // revert the draft take entirely
        endSession();
    }, [onLiveText, endSession]);

    const handleStart = useCallback(() => {
        if (!voiceService.isSupported()) return;
        baseTextRef.current = value;
        finalRef.current = '';
        interimRef.current = '';
        startedAtRef.current = Date.now();
        const handlers = {
            onFinal: (finalText: string) => {
                finalRef.current = finalText;
                onLiveText(combineTranscript(baseTextRef.current, finalText, interimRef.current));
            },
            onInterim: (interim: string) => {
                interimRef.current = interim;
                onLiveText(combineTranscript(baseTextRef.current, finalRef.current, interim));
            },
            onEnd: () => {
                // Natural close: silence timeout or engine stop outside a release click.
                if (!startedAtRef.current) {
                    // Session already retired (release/cancel/busy stand-down) —
                    // still reset UI state so a stale listening face can't stick.
                    endSession();
                    return;
                }
                const finalText = combineTranscript(baseTextRef.current, finalRef.current, '');
                endSession();
                onNaturalEnd(finalText);
            },
            onSuperseded: () => {
                // Another chat surface took the shared mic. Stand down quietly —
                // this session's draft belongs to that surface now.
                startedAtRef.current = 0;
                endSession();
            },
            onError: (error: unknown) => {
                // Late engine noise after an intentional release/cancel must not
                // revert the input or raise a toast (Chrome aborts on stop()).
                if (!startedAtRef.current) return;
                onLiveText(baseTextRef.current);
                endSession();
                onMicError(error);
            },
        };
        handlersRef.current = handlers;
        const started = voiceService.startDictation(handlers);
        if (started) {
            onSessionStart?.();
            setIsListening(true);
        }
    }, [value, onLiveText, onSessionStart, onNaturalEnd, onMicError, endSession]);

    const handleRelease = useCallback(() => {
        const listenedMs = Date.now() - startedAtRef.current;
        if (handlersRef.current) voiceService.stopDictationIfOwner(handlersRef.current);

        // Jitter guard: a near-instant second click is not a deliberate release.
        if (listenedMs < MIN_LISTEN_MS) {
            onLiveText(baseTextRef.current);
            startedAtRef.current = 0; // suppress the pending onEnd natural-end report
            endSession();
            return;
        }
        const text = combineTranscript(baseTextRef.current, finalRef.current, interimRef.current);
        startedAtRef.current = 0;
        endSession();
        onRelease({ text, autoSend: isAutoSendArmed() });
    }, [onLiveText, onRelease, isAutoSendArmed, endSession]);

    // Esc while the talkback is open cancels without sending.
    useEffect(() => {
        if (!isListening) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                handleCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isListening, handleCancel]);

    const handleClick = useCallback(() => {
        if (face === 'busy') {
            onStopAgent?.();
            return;
        }
        if (face === 'listening') {
            handleRelease();
        } else {
            handleStart();
        }
    }, [face, onStopAgent, handleRelease, handleStart]);

    const padClass = sizeVariant === 'docked'
        ? 'p-1.5 rounded-lg'
        : sizeVariant === 'mobile'
            ? 'p-2 min-w-[32px] w-8 h-8 rounded-lg'
            : 'gap-2 px-4 h-9 rounded-full text-xs';
    const showLabel = sizeVariant === 'default';
    const iconSize = sizeVariant === 'docked' ? 16 : 18;

    const ariaLabel =
        face === 'busy'
            ? 'Stop agent'
            : face === 'listening'
                ? 'Release to send'
                : 'Voice Input';

    const label = face === 'busy' ? 'Stop' : face === 'listening' ? 'Release' : 'Talk';

    return (
        <button
            ref={ref}
            onClick={handleClick}
            disabled={disabled}
            data-testid={face === 'busy' ? 'command-bar-stop-btn' : 'talk-button'}
            data-face={face}
            aria-label={ariaLabel}
            className={cn(
                // Studio talkback treatment: a real button, not a bare icon.
                // Red = live/on-air, matching the previous Stop affordance.
                'flex items-center justify-center font-bold shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none text-white',
                padClass,
                accent === 'indii' && face === 'idle' && 'bg-green-600 hover:bg-green-500 shadow-green-500/20',
                accent !== 'indii' && face === 'idle' && 'bg-white/20 hover:bg-white/30 border border-white/10',
                (face === 'listening' || face === 'busy') && 'bg-red-600 hover:bg-red-500 shadow-red-500/30',
                face === 'listening' && 'animate-pulse',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
                className
            )}
        >
            {face === 'busy' ? (
                <Square size={iconSize - 4} fill="currentColor" />
            ) : (
                <Mic size={iconSize} className={cn(face === 'listening' && 'animate-none')} />
            )}
            {showLabel && <span>{label}</span>}
        </button>
    );
});

TalkButton.displayName = 'TalkButton';

export default TalkButton;
