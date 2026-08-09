import { memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { logger } from '@/utils/logger';
import { recordSignal } from '@/services/persona/PersonaInteractionRecorder';
import { getPersonaResponseMetadata } from '@/services/persona/PersonaResponseMetadata';

interface PersonaResponseActionsProps {
    text: string;
    metadata?: Record<string, unknown>;
}

/** User-visible response actions that emit response-correlated implicit signals. */
export const PersonaResponseActions = memo(({ text, metadata }: PersonaResponseActionsProps) => {
    const [copied, setCopied] = useState(false);
    const tracking = getPersonaResponseMetadata(metadata);

    if (!tracking) return null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);

        void recordSignal(tracking.personaId, tracking.responseId, 'copied').catch((error) => {
            logger.warn('[PersonaResponseActions] Copy succeeded but its implicit signal could not be recorded.', {
                personaId: tracking.personaId,
                isControlGroup: tracking.isControlGroup,
                reason: error instanceof Error ? error.name : 'unknown',
            });
        });
    };

    return (
        <div className="mt-2 flex items-center">
            <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-white/70 transition-colors"
                aria-label={copied ? 'Response copied' : 'Copy response'}
            >
                {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
        </div>
    );
});

PersonaResponseActions.displayName = 'PersonaResponseActions';
