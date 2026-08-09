import { memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { logger } from '@/utils/logger';
import { recordSignalWithResult } from '@/services/persona/PersonaInteractionRecorder';
import { getPersonaResponseMetadata } from '@/services/persona/PersonaResponseMetadata';

interface PersonaResponseActionsProps {
    text: string;
    metadata?: Record<string, unknown>;
}

function copyWithDocumentFallback(text: string): boolean {
    if (typeof document.execCommand !== 'function') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        return document.execCommand('copy');
    } finally {
        textArea.remove();
    }
}

async function copyResponseText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            if (copyWithDocumentFallback(text)) return;
            throw error;
        }
    }

    if (!copyWithDocumentFallback(text)) {
        throw new Error('Clipboard API unavailable');
    }
}

/** User-visible response actions that emit response-correlated implicit signals. */
export const PersonaResponseActions = memo(({ text, metadata }: PersonaResponseActionsProps) => {
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [signalStatus, setSignalStatus] = useState<
        'idle' | 'saving' | 'recorded' | 'failed' | 'unauthenticated' | 'not-recorded'
    >('idle');
    const tracking = getPersonaResponseMetadata(metadata);

    if (!tracking) return null;

    const handleCopy = async () => {
        setCopyStatus('idle');
        setSignalStatus('idle');

        try {
            await copyResponseText(text);
            setCopyStatus('copied');
        } catch (error) {
            setCopyStatus('failed');
            setSignalStatus('not-recorded');
            logger.warn('[PersonaResponseActions] Response copy failed; no copied signal was recorded.', {
                personaId: tracking.personaId,
                isControlGroup: tracking.isControlGroup,
                reason: error instanceof Error ? error.name : 'unknown',
            });
            return;
        }

        setSignalStatus('saving');
        try {
            const result = await recordSignalWithResult(tracking.personaId, tracking.responseId, 'copied');
            setSignalStatus(result === 'recorded' ? 'recorded' : 'unauthenticated');
        } catch (error) {
            setSignalStatus('failed');
            logger.warn('[PersonaResponseActions] Copy signal could not be recorded.', {
                personaId: tracking.personaId,
                isControlGroup: tracking.isControlGroup,
                reason: error instanceof Error ? error.name : 'unknown',
            });
        }
    };

    let copyLabel = 'Copy response';
    if (copyStatus === 'copied') copyLabel = 'Response copied';
    if (copyStatus === 'failed') copyLabel = 'Response copy failed';

    let signalLabel: string | null = null;
    if (signalStatus === 'saving') signalLabel = 'Saving feedback…';
    if (signalStatus === 'recorded') signalLabel = 'Feedback saved';
    if (signalStatus === 'failed') signalLabel = 'Feedback not saved';
    if (signalStatus === 'unauthenticated') signalLabel = 'Sign in to save feedback';
    if (signalStatus === 'not-recorded') signalLabel = 'Feedback not recorded';

    return (
        <div className="mt-2 flex items-center gap-2">
            <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-white/70 transition-colors"
                aria-label={copyLabel}
            >
                {copyStatus === 'copied' ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                <span>{copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy'}</span>
            </button>
            {signalLabel && (
                <span role="status" className="text-[10px] text-white/40">
                    {signalLabel}
                </span>
            )}
        </div>
    );
});

PersonaResponseActions.displayName = 'PersonaResponseActions';
