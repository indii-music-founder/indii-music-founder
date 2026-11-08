import type { ValidAgentId } from '@/services/agent/types';

export const GEMINI_TTS_VOICES = [
    'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe',
    'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux',
    'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima',
    'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel',
    'Vindemiatrix', 'Zephyr', 'Zubenelgenubi',
] as const;

export type GeminiTTSVoice = typeof GEMINI_TTS_VOICES[number];

export interface VoiceOptionMeta {
    readonly voice: GeminiTTSVoice;
    readonly tone: string;
    readonly sampleLine: string;
}

/**
 * Curated "Less is More" quick-pick voice palette for the UI selector,
 * while all 30 Gemini voices remain valid across the 31 agents.
 */
export const CURATED_VOICE_OPTIONS: readonly VoiceOptionMeta[] = Object.freeze([
    { voice: 'Kore', tone: 'Warm & Composed', sampleLine: 'indii Conductor online. What are we building today?' },
    { voice: 'Aoede', tone: 'Expressive & Lyrical', sampleLine: 'Let us shape the visual and sonic identity for this release.' },
    { voice: 'Charon', tone: 'Deep & Analytical', sampleLine: 'All financial and royalty ledgers are reconciled.' },
    { voice: 'Fenrir', tone: 'Bold & Energetic', sampleLine: 'Campaign velocity is climbing. Ready to push the next drop.' },
    { voice: 'Puck', tone: 'Quick & Clever', sampleLine: 'Social hooks are queued and timed for peak engagement.' },
    { voice: 'Leda', tone: 'Refined & Clear', sampleLine: 'Contract terms and split sheets are verified and ready.' },
    { voice: 'Orus', tone: 'Steady & Authoritative', sampleLine: 'Distribution pipeline and DSP metadata checks passed.' },
    { voice: 'Zephyr', tone: 'Bright & Airy', sampleLine: 'Here is a fresh perspective on your upcoming tour routing.' },
]);

/**
 * Canonical default voice assignment for every agent in VALID_AGENT_IDS.
 * Every department head and specialist gets a distinct voice character.
 */
export const DEFAULT_AGENT_VOICES: Readonly<Record<ValidAgentId, GeminiTTSVoice>> = Object.freeze({
    generalist: 'Kore',
    creative: 'Aoede',
    music: 'Callirrhoe',
    video: 'Enceladus',
    director: 'Orus',
    producer: 'Iapetus',
    screenwriter: 'Laomedeia',
    marketing: 'Fenrir',
    social: 'Puck',
    publicist: 'Despina',
    brand: 'Pulcherrima',
    finance: 'Charon',
    'finance.accounting': 'Sadaltager',
    'finance.tax': 'Rasalgethi',
    'finance.royalty': 'Algieba',
    legal: 'Leda',
    'legal.contracts': 'Schedar',
    'legal.compliance': 'Erinome',
    distribution: 'Alnilam',
    publishing: 'Gacrux',
    licensing: 'Achernar',
    rights: 'Vindemiatrix',
    road: 'Zephyr',
    hospitality: 'Sulafat',
    'event-planner': 'Autonoe',
    merchandise: 'Achird',
    analytics: 'Algenib',
    devops: 'Umbriel',
    security: 'Sadachbia',
    curriculum: 'Zubenelgenubi',
    keeper: 'Kore',
});

const VOICE_OVERRIDES_STORAGE_KEY = 'indii_agent_voice_overrides';

export function isGeminiTTSVoice(value: unknown): value is GeminiTTSVoice {
    return typeof value === 'string' && (GEMINI_TTS_VOICES as readonly string[]).includes(value as GeminiTTSVoice);
}

export function loadPersistedVoiceOverrides(): Record<string, GeminiTTSVoice> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(VOICE_OVERRIDES_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const clean: Record<string, GeminiTTSVoice> = {};
        for (const [key, val] of Object.entries(parsed)) {
            if (isGeminiTTSVoice(val)) {
                clean[key] = val;
            }
        }
        return clean;
    } catch {
        return {};
    }
}

export function savePersistedVoiceOverrides(overrides: Record<string, GeminiTTSVoice>): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(VOICE_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
        // Ignore storage quota errors
    }
}

export function resolveAgentVoice(
    agentId: string | null | undefined,
    overrides?: Record<string, string>
): GeminiTTSVoice {
    const normalized = (agentId || 'generalist').trim().toLowerCase();
    const effectiveOverrides = overrides ?? loadPersistedVoiceOverrides();
    const override = effectiveOverrides[normalized];
    if (isGeminiTTSVoice(override)) {
        return override;
    }
    const mapped = (DEFAULT_AGENT_VOICES as Readonly<Record<string, GeminiTTSVoice>>)[normalized as ValidAgentId];
    return mapped || 'Kore';
}

export function getVoiceToneLabel(voice: GeminiTTSVoice): string {
    const found = CURATED_VOICE_OPTIONS.find(v => v.voice === voice);
    return found ? found.tone : 'Studio Voice';
}

/**
 * Strips markdown, code blocks, internal tool blocks, and URLs so TTS
 * reads natural conversational prose instead of punctuation noise.
 */
export function stripMarkdownForSpeech(rawText: string): string {
    if (!rawText) return '';
    return rawText
        // Strip internal [Tool: ...]...[End Tool ...] blocks
        .replace(/\[Tool:\s*[\w-]+\][\s\S]*?\[End Tool\s*[\w-]+\]/gi, '')
        // Strip fenced code blocks
        .replace(/```[\s\S]*?```/g, ' ')
        // Strip inline code ticks
        .replace(/`([^`]+)`/g, '$1')
        // Strip markdown images and links -> keep link label
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Strip bare URLs
        .replace(/https?:\/\/\S+/g, '')
        // Strip markdown headings, blockquotes, bullets, bold/italics, horizontal rules
        .replace(/^[#>*\-\s]+/gm, '')
        .replace(/[*_~]{1,3}/g, '')
        // Collapse whitespace and cap to 1500 chars for responsive conversational turn audio
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500);
}
