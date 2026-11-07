import { httpsCallable, getFunctions } from 'firebase/functions';
import { judgmentsAvailable } from '@/config/typesafeJudgments';

export interface SpokenConversationIntentVerdict {
    action: 'barge_in_stop' | 'product_skill' | 'agent_reassignment' | 'general_conversation';
    confidence: number;
    skillId?: string;
    targetAgentId?: string;
    explanation?: string;
}

const BARGE_IN_WORDS = ['stop', 'hold on', 'wait', 'quiet', 'pause', 'shut up', 'cancel'];

export function deterministicSpokenIntentFallback(
    spokenText: string,
): SpokenConversationIntentVerdict {
    const clean = spokenText.trim().toLowerCase();
    if (!clean) {
        return { action: 'general_conversation', confidence: 1 };
    }

    // Direct barge-in stop check
    for (const word of BARGE_IN_WORDS) {
        if (clean === word || clean.startsWith(`${word} `) || clean.endsWith(` ${word}`)) {
            return {
                action: 'barge_in_stop',
                confidence: 0.95,
                explanation: `Detected stop command: "${word}"`,
            };
        }
    }

    // Direct agent address check
    const addressMatch = clean.match(/^(?:hey|ask|tell|message)\s+([a-z.-]+)/i);
    if (addressMatch && addressMatch[1]) {
        return {
            action: 'agent_reassignment',
            confidence: 0.8,
            targetAgentId: addressMatch[1].toLowerCase(),
            explanation: `Addressed agent: ${addressMatch[1]}`,
        };
    }

    return {
        action: 'general_conversation',
        confidence: 0.9,
    };
}

/**
 * Evaluates spoken turns with Jev System One via typesafeJudge callable.
 */
export async function judgeSpokenConversationIntent(
    spokenText: string,
    currentAgentId?: string,
): Promise<SpokenConversationIntentVerdict> {
    const fallback = deterministicSpokenIntentFallback(spokenText);
    if (fallback.action === 'barge_in_stop' || !judgmentsAvailable()) {
        return fallback;
    }

    try {
        const judgeFn = httpsCallable<
            { state: Record<string, unknown>; questions: Record<string, unknown> },
            { answers: Record<string, unknown> }
        >(getFunctions(), 'typesafeJudge');

        const result = await judgeFn({
            state: {
                utterance: spokenText.slice(0, 300),
                currentAgentId: currentAgentId || 'generalist',
            },
            questions: {
                intent: {
                    type: 'choice' as const,
                    instructions: "Analyze the user's spoken utterance in an artist studio session. Is the user telling the agent to stop/pause, directing the question to a specific domain specialist, invoking a product skill, or holding general conversation?",
                    criteria: {
                        barge_in_stop: "User explicitly wants to halt, silence, or stop the current speech or process.",
                        agent_reassignment: "User explicitly addresses or asks for a specific department specialist (e.g., legal, finance, distribution, creative).",
                        product_skill: "User is asking to run a specific music studio playbook or workflow (e.g. audit brand, create cover art, prepare distribution, calculate royalties).",
                        general_conversation: "Natural conversational dialogue, brainstorming, feedback, or follow-up question.",
                    },
                },
            },
        });

        const answer = result.data.answers?.intent;
        const choice = typeof answer === 'string' ? answer : (answer as { choice?: unknown } | null)?.choice;
        const rawConfidence =
            typeof answer === 'object' && answer !== null
                ? (answer as { confidence?: unknown }).confidence
                : undefined;

        if (
            choice === 'barge_in_stop' ||
            choice === 'agent_reassignment' ||
            choice === 'product_skill' ||
            choice === 'general_conversation'
        ) {
            const confidence =
                typeof rawConfidence === 'number' && Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
                    ? rawConfidence
                    : 0.85;

            return {
                action: choice,
                confidence,
                targetAgentId: fallback.targetAgentId,
            };
        }
    } catch {
        // Safe fallback on network or service error
    }

    return fallback;
}
