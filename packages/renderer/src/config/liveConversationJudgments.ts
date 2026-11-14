import { httpsCallable, getFunctions } from 'firebase/functions';
import { judgmentsAvailable, noteJudgmentFailure } from '@/config/typesafeJudgments';

const INTENT_MIN_CONFIDENCE = 0.5;
const SPECIALIST_MIN_CONFIDENCE = 0.5;

export interface SpokenConversationIntentVerdict {
    action: 'barge_in_stop' | 'product_skill' | 'agent_reassignment' | 'general_conversation';
    confidence: number;
    skillId?: string;
    targetAgentId?: string;
    explanation?: string;
}

const BARGE_IN_WORDS = [
    'stop', 'hold on', 'wait', 'quiet', 'pause', 'shut up', 'cancel',
    'shh', 'silence', 'enough', 'be quiet', 'stop talking', 'halt'
];

const SPECIALIST_KEYWORDS: Readonly<Record<string, string>> = Object.freeze({
    legal: 'legal',
    lawyer: 'legal',
    contract: 'legal.contracts',
    contracts: 'legal.contracts',
    compliance: 'legal.compliance',
    finance: 'finance',
    accounting: 'finance.accounting',
    accountant: 'finance.accounting',
    tax: 'finance.tax',
    royalty: 'finance.royalty',
    royalties: 'finance.royalty',
    creative: 'creative',
    art: 'creative',
    artwork: 'creative',
    cover: 'creative',
    music: 'music',
    audio: 'music',
    stem: 'music',
    stems: 'music',
    video: 'video',
    visualizer: 'video',
    director: 'director',
    producer: 'producer',
    screenwriter: 'screenwriter',
    script: 'screenwriter',
    marketing: 'marketing',
    campaign: 'marketing',
    social: 'social',
    instagram: 'social',
    tiktok: 'social',
    twitter: 'social',
    publicist: 'publicist',
    press: 'publicist',
    pr: 'publicist',
    brand: 'brand',
    distribution: 'distribution',
    distro: 'distribution',
    dsp: 'distribution',
    spotify: 'distribution',
    publishing: 'publishing',
    licensing: 'licensing',
    sync: 'licensing',
    rights: 'rights',
    road: 'road',
    tour: 'road',
    booking: 'road',
    hospitality: 'hospitality',
    rider: 'hospitality',
    merchandise: 'merchandise',
    merch: 'merchandise',
    analytics: 'analytics',
    stats: 'analytics',
    streams: 'analytics',
    devops: 'devops',
    security: 'security',
    conductor: 'generalist',
    generalist: 'generalist',
});

export function deterministicSpokenIntentFallback(
    spokenText: string,
): SpokenConversationIntentVerdict {
    const clean = spokenText.trim().toLowerCase();
    if (!clean) {
        return { action: 'general_conversation', confidence: 1 };
    }

    // Direct barge-in stop check
    for (const word of BARGE_IN_WORDS) {
        if (clean === word || clean.startsWith(`${word} `) || clean.endsWith(` ${word}`) || clean.includes(` ${word} `)) {
            return {
                action: 'barge_in_stop',
                confidence: 0.95,
                explanation: `Detected stop command: "${word}"`,
            };
        }
    }

    // Direct address check (e.g., "hey legal", "ask finance", "tell marketing", "message distribution")
    const addressMatch = clean.match(/^(?:hey|ask|tell|message|switch to|bring in|have|let)\s+([a-z.-]+)/i);
    if (addressMatch && addressMatch[1]) {
        const candidate = addressMatch[1].toLowerCase();
        const mappedId = SPECIALIST_KEYWORDS[candidate] || candidate;
        return {
            action: 'agent_reassignment',
            confidence: 0.85,
            targetAgentId: mappedId,
            explanation: `Addressed agent: ${mappedId}`,
        };
    }

    // Keyword specialist match across common natural inquiries
    for (const [kw, agentId] of Object.entries(SPECIALIST_KEYWORDS)) {
        const regex = new RegExp(`\\b(?:ask|tell|consult|check with|have)\\s+${kw}\\b`, 'i');
        if (regex.test(clean)) {
            return {
                action: 'agent_reassignment',
                confidence: 0.8,
                targetAgentId: agentId,
                explanation: `Matched specialist keyword: ${kw} -> ${agentId}`,
            };
        }
    }

    return {
        action: 'general_conversation',
        confidence: 0.9,
    };
}

/**
 * Evaluates spoken turns with Jev System One via typesafeJudge callable.
 * Uses parallel speculative questions:
 *   - bargeInStop (Noul): fast probability of interrupt/silence intent
 *   - intent (Choice): 4-way conversation action classification
 *   - targetSpecialist (Choice): speculative routing to one of the studio specialists
 */
export async function judgeSpokenConversationIntent(
    spokenText: string,
    currentAgentId?: string,
): Promise<SpokenConversationIntentVerdict> {
    const fallback = deterministicSpokenIntentFallback(spokenText);
    if (fallback.action === 'barge_in_stop' || !judgmentsAvailable('judgeSpokenConversationIntent')) {
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
                bargeInStop: {
                    type: 'noul' as const,
                    instructions: "Is the user commanding the studio agent to stop talking, pause, hush, silence, cancel, or wait right now?",
                },
                intent: {
                    type: 'choice' as const,
                    instructions: "Analyze the user's spoken utterance in an artist studio session. Is the user commanding a stop, directing the inquiry to a specific department specialist, invoking a product skill, or engaging in general conversation?",
                    criteria: {
                        barge_in_stop: "User explicitly wants to halt, silence, or stop the current speech or process.",
                        agent_reassignment: "User addresses or asks for a specific department specialist (e.g., legal, finance, distribution, creative, marketing, road, publishing, licensing).",
                        product_skill: "User asks to run a specific music studio playbook or automated task (e.g. audit brand, generate cover art, calculate royalties, submit release).",
                        general_conversation: "Natural conversational dialogue, brainstorming, feedback, or follow-up question.",
                    },
                },
                targetSpecialist: {
                    type: 'choice' as const,
                    instructions: "When this inquiry calls for a studio department specialist, which department is most qualified?",
                    criteria: {
                        legal: "Contracts, copyright, trademarks, sync clearance, split sheets, dispute review.",
                        finance: "Royalties, recoupment, budgets, revenue, accounting, taxes, payout ledgers.",
                        creative: "Cover art, logos, prompt engineering, visual branding, photo styling.",
                        video: "Music videos, visualizers, teasers, aspect ratios, motion clips.",
                        music: "Stems, audio mixing, mastering, track production, composition.",
                        marketing: "Campaigns, launch strategy, advertising, audience demographics, growth.",
                        social: "TikTok, Instagram, Twitter/X, hooks, captions, social schedule.",
                        distribution: "DSP ingestion, Spotify, Apple Music, ISRC/UPC, metadata, delivery.",
                        publishing: "PRO registration (ASCAP/BMI), publishing royalties, catalog indexing.",
                        licensing: "Sync licensing, pitching to film/TV/games, clearance agreements.",
                        publicist: "Press releases, media pitching, journalist outreach, interviews.",
                        road: "Tour routing, venue scouting, gig travel, live performance logistics.",
                        brand: "Brand identity, tone of voice, visual cohesion, brand narrative.",
                    },
                },
            },
        });

        return parseSpokenIntentAnswers(result.data.answers, fallback);
    } catch (err: unknown) {
        noteJudgmentFailure(err, 'spoken conversation intent judgment', 'judgeSpokenConversationIntent');
    }

    return fallback;
}

/** Pure answer composition; does not execute or authorize any action. */
export function parseSpokenIntentAnswers(
    rawAnswers: unknown,
    fallback: SpokenConversationIntentVerdict,
): SpokenConversationIntentVerdict {
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) return fallback;
    const answers = rawAnswers as Record<string, unknown>;
    // Only documented bounded Noul values can trigger semantic interruption.
    const bargeInRaw = answers.bargeInStop;
    const bargeInProb = typeof bargeInRaw === 'number'
        ? bargeInRaw
        : bargeInRaw !== null && typeof bargeInRaw === 'object' && !Array.isArray(bargeInRaw)
            ? (bargeInRaw as Record<string, unknown>).noul
            : undefined;

    if (typeof bargeInProb === 'number' && Number.isFinite(bargeInProb) && bargeInProb >= 0.75 && bargeInProb <= 1) {
        return {
            action: 'barge_in_stop',
            confidence: bargeInProb,
            explanation: 'Jev System One Noul detected stop command with high probability',
        };
    }

    const intentAnswer = answers.intent;
    const intent = intentAnswer !== null && typeof intentAnswer === 'object' && !Array.isArray(intentAnswer)
        ? intentAnswer as Record<string, unknown>
        : undefined;
    const choice = intent?.choice;
    const confidence = intent?.confidence;
    if (typeof choice !== 'string' || !['barge_in_stop', 'agent_reassignment', 'product_skill', 'general_conversation'].includes(choice) ||
        typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < INTENT_MIN_CONFIDENCE || confidence > 1) return fallback;

    const specAnswer = answers.targetSpecialist;
    const specialist = specAnswer !== null && typeof specAnswer === 'object' && !Array.isArray(specAnswer)
        ? specAnswer as Record<string, unknown>
        : undefined;
    const specChoice = specialist?.choice;
    const specConfidence = specialist?.confidence;
    const validSpecialist = typeof specChoice === 'string' &&
        ['legal', 'finance', 'creative', 'video', 'music', 'marketing', 'social', 'distribution', 'publishing', 'licensing', 'publicist', 'road', 'brand'].includes(specChoice) &&
        typeof specConfidence === 'number' && Number.isFinite(specConfidence) && specConfidence >= SPECIALIST_MIN_CONFIDENCE && specConfidence <= 1;
    const targetSpecialist = validSpecialist ? specChoice : fallback.targetAgentId;

    if (choice === 'barge_in_stop') {
        return { action: 'barge_in_stop', confidence };
    }

    if (choice === 'agent_reassignment') {
        if (!targetSpecialist) return fallback;
        return {
            action: 'agent_reassignment',
            confidence,
            targetAgentId: targetSpecialist,
            explanation: `Jev routed to specialist: ${targetSpecialist}`,
        };
    }

    if (choice === 'product_skill') {
        return { action: 'product_skill', confidence, targetAgentId: targetSpecialist };
    }

    return {
        action: 'general_conversation',
        confidence,
        targetAgentId: fallback.targetAgentId,
    };
}
