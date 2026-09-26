import type {
    CapabilityKey,
    CapabilitySnapshot,
    CapabilityStatus,
} from '@shared/schemas/capabilitySnapshot';

export type CapabilityHealthKey =
    | 'image_generation'
    | 'video_generation'
    | 'specialist_routing';
export type CapabilityHealthStatus = 'available' | 'degraded' | 'unavailable';

export interface CapabilityHealth {
    status: CapabilityHealthStatus;
    retryAfterSeconds?: number;
    observedAt: number;
}

const HEALTH_TTL_MS = 5 * 60_000;
const healthByCapability = new Map<CapabilityHealthKey, CapabilityHealth>();

export function recordCapabilityHealth(
    capability: CapabilityHealthKey,
    health: Omit<CapabilityHealth, 'observedAt'> & { observedAt?: number },
): void {
    healthByCapability.set(capability, {
        ...health,
        observedAt: health.observedAt ?? Date.now(),
    });
}

export function getCapabilityHealth(now = Date.now()): Partial<Record<CapabilityHealthKey, CapabilityHealth>> {
    const result: Partial<Record<CapabilityHealthKey, CapabilityHealth>> = {};
    for (const [capability, health] of healthByCapability) {
        if (now - health.observedAt <= HEALTH_TTL_MS) result[capability] = health;
    }
    return result;
}

export function resetCapabilityHealthForTests(): void {
    healthByCapability.clear();
}

export function isDepartmentAuditOrReadinessQuestion(task: string): boolean {
    const normalized = task.trim().replace(/[’]/g, "'").replace(/\s+/g, ' ');

    // Specific functional inquiries targeting canvas, editor, or workspace artifacts
    // are operational feature requests rather than broad department fleet audits.
    if (/\b(?:agent canvas|project canvas|canvas|layer editor|timeline)\b/i.test(normalized)) {
        return false;
    }

    const targets = String.raw`(?:(?:the )?(?:other )?(?:23 )?(?:agents?|departments?|specialists?|department heads?)|(?:all|any)(?: of the)? (?:23 )?(?:agents?|departments?|specialists?|department heads?)|(?:all )?(?:23 )?departments?|all \d+ department heads?|(?:the )?other \d+|\ball \d+\b)`;

    return [
        new RegExp(String.raw`\bdid ${targets}(?: (?:the )?other \d+)? (?:get|have|receive) (?:their )?(?:requested )?tools?\b`, 'i'),
        new RegExp(String.raw`\bhave ${targets}(?: (?:the )?other \d+)? (?:gotten|received|got|acquired) (?:their )?(?:requested )?tools?\b`, 'i'),
        new RegExp(String.raw`\bare (?:the )?(?:tools? (?:for|of) )?${targets}(?:'s)? (?:tools? )?(?:ready|deployed|implemented|operational|available|working|built)(?: right now| now)?\b`, 'i'),
        new RegExp(String.raw`\b(?:what|which) tools? (?:do|can) ${targets} (?:have|use|access)\b`, 'i'),
        new RegExp(String.raw`\b(?:do|can) ${targets} have (?:their )?(?:requested )?tools?\b`, 'i'),
        new RegExp(String.raw`\b(?:board-wide|department|fleet|agent|system-wide) audit\b`, 'i'),
        new RegExp(String.raw`\baudit (?:of )?(?:all )?(?:the )?(?:23 )?(?:department heads?|departments?|agents?)\b`, 'i'),
        new RegExp(String.raw`\b(?:are|is) ${targets} (?:in a )?holding pattern\b`, 'i'),
        new RegExp(String.raw`\b(?:in a )?holding pattern\b`, 'i'),
        new RegExp(String.raw`\b(?:is there|are we in) (?:an? )?(?:holding pattern|engineering sprint|build phase)\b`, 'i'),
        new RegExp(String.raw`\bwaiting for (?:an? |the )?engineering sprint\b`, 'i'),
        new RegExp(String.raw`\bengineering[- ]sprint\b`, 'i'),
        new RegExp(String.raw`\bstatus of (?:the )?(?:23 )?(?:department heads?|departments?|specialists?|agents?)\b`, 'i'),
        new RegExp(String.raw`\bstatus (?:check|report) on (?:the )?(?:23 )?(?:department heads?|departments?|agents?)\b`, 'i'),
        new RegExp(String.raw`\bhow are (?:all |the )?${targets} (?:doing|equipped|configured|faring)\b`, 'i'),
        new RegExp(String.raw`\b(?:what is the|give me a) status of (?:all |the )?${targets}\b`, 'i'),
        new RegExp(String.raw`\bare (?:all )?${targets} (?:ready|working|operational|online|set up|active)\b`, 'i'),
        new RegExp(String.raw`\b(?:any|are there) (?:missing (?:tools|capabilities)|tool deficits?|unimplemented tools|unbuilt tools)\b`, 'i'),
        /\btool deficit\b/i,
        /\bmaster technical specification\b/i,
        /\bbuild phase\b/i,
        /\btechnical roadmap\b/i,
        /\bawaits? (?:further )?engineering\b/i,
        /\boperations remain restricted\b/i,
    ].some(pattern => pattern.test(normalized));
}

export function isCapabilityQuestion(task: string): boolean {
    const normalized = task.trim().replace(/[’]/g, "'").replace(/\s+/g, ' ');
    if (isDepartmentAuditOrReadinessQuestion(normalized)) {
        return true;
    }
    const subject = String.raw`(?:you|indii|(?:the )?(?:other )?agents?|(?:the )?(?:other )?departments?|specialists?)`;

    return [
        new RegExp(String.raw`\bwhat can(?: and can(?:not|'t))? ${subject} do\b`, 'i'),
        new RegExp(String.raw`\bwhat (?:can(?:not|'t)|can't) ${subject} do\b`, 'i'),
        new RegExp(String.raw`\bwhat are (?:your|indii(?:'s)?|the|the other) (?:agents?'? |departments?'? )?capabilit(?:y|ies)\b`, 'i'),
        new RegExp(String.raw`\b(?:tell|show|list|explain)(?: me)? (?:your|indii(?:'s)?|the) (?:agents?'? |departments?'? )?capabilit(?:y|ies)\b`, 'i'),
        new RegExp(String.raw`\b(?:what|which) tools? (?:do|can) ${subject} (?:have(?: access to)?|access|use|get)\b`, 'i'),
        new RegExp(String.raw`\b(?:do|can) ${subject} (?:have access to|access|use|have) (?:any |the )?tools?\b`, 'i'),
        new RegExp(String.raw`\bare (?:your|indii(?:'s)?|the|the other) (?:agents?'? |departments?'? )?tools? (?:available|ready|working|accessible|deployed|implemented)(?: right now| now)?\b`, 'i'),
        new RegExp(String.raw`\bdid (?:the )?(?:other )?agents?(?: (?:the )?other \d+)? (?:get|have) (?:their )?(?:requested )?tools?\b`, 'i'),
        new RegExp(String.raw`\bhave (?:the )?(?:other )?agents?(?: (?:the )?other \d+)? (?:gotten|received|got) (?:their )?(?:requested )?tools?\b`, 'i'),
        /\b(?:is|are) (?:image|video)(?: generation)? (?:available|ready|working)(?: right now| now)?\b/i,
        new RegExp(String.raw`\b(?:can|could) ${subject} (?:generate|create|make)(?: me)? (?:an? |any )?(?:image|images|picture|pictures|visual|visuals|video|videos)(?: right now| now)?\??$`, 'i'),
        new RegExp(String.raw`\b(?:can|could) ${subject} (?:generate|create|make)(?: me)? (?:an? |any )?(?:image|images|picture|pictures|visual|visuals|video|videos).{0,40}\b(?:ability|able|capable|available|ready)\b`, 'i'),
        new RegExp(String.raw`\b(?:is|are) ${subject} (?:able|ready) to (?:generate|create|make)(?: me)? (?:an? |any )?(?:image|images|picture|pictures|visual|visuals|video|videos)(?: right now| now)?\b`, 'i'),
    ].some(pattern => pattern.test(normalized));
}

const SAFE_DIRECT_CAPABILITIES: Array<{
    tools: string[];
    key: CapabilityKey;
    label: string;
}> = [
    {
        tools: ['create_project', 'list_projects', 'list_files', 'search_files', 'search_knowledge', 'canvas_inspect', 'canvas_push'],
        key: 'durable_workspace',
        label: 'organize projects, inspect canvas, and find workspace material',
    },
    {
        tools: ['save_memory', 'recall_memories'],
        key: 'durable_memory',
        label: 'save and recall approved workspace context',
    },
    { tools: ['generate_image'], key: 'image_generation', label: 'create images' },
    { tools: ['generate_video'], key: 'video_generation', label: 'create videos' },
];

const SAFE_SPECIALIST_LABELS: Record<string, string> = {
    finance: 'finance analysis',
    legal: 'contract review',
    distribution: 'release-readiness guidance',
    marketing: 'marketing planning',
    brand: 'brand identity & compliance',
    music: 'music and metadata review',
    video: 'video production',
    social: 'social scheduling & strategy',
    publicist: 'PR & media outreach',
    publishing: 'publishing & PRO catalog review',
    licensing: 'licensing & sync opportunities',
    road: 'tour routing & live logistics',
    hospitality: 'artist hospitality & accommodation',
    'event-planner': 'event production & planning',
    merchandise: 'merchandise & product design',
    creative: 'creative direction & visual production',
    producer: 'production logistics & call sheets',
    director: 'creative direction',
    screenwriter: 'screenplay formatting & script analysis',
    devops: 'cloud infrastructure & reliability',
    security: 'security audits & access control',
    curriculum: 'music business education',
    keeper: 'context integrity & memory',
};

const SOCIAL_PUBLISHING_TOOLS = [
    'schedule_post_execution',
    'multi_platform_autopost',
    'dispatch_community_webhook',
];
const CALENDAR_ACTION_TOOLS = [
    'create_calendar_event',
    'update_calendar_event',
    'delete_calendar_event',
];

export function buildCapabilitySummary(input: {
    authorizedTools: string[];
    registeredSpecialistIds: string[];
    snapshot: CapabilitySnapshot;
    health?: Partial<Record<CapabilityHealthKey, CapabilityHealth>>;
    query?: string;
}): string {
    if (input.query && isDepartmentAuditOrReadinessQuestion(input.query)) {
        return buildDepartmentAuditReport({ query: input.query });
    }
    const authorized = new Set(input.authorizedTools);
    const health = input.health ?? {};
    const available: string[] = [];
    const degraded: string[] = [];
    const blocked: string[] = [];
    const unverified: string[] = [];

    const effectiveStatus = (key: CapabilityKey): CapabilityStatus => {
        const serverStatus = input.snapshot.capabilities[key].status;
        if (serverStatus !== 'available') return serverStatus;
        if (key !== 'image_generation' && key !== 'video_generation' && key !== 'specialist_routing') {
            return serverStatus;
        }
        const local = health[key];
        if (local?.status === 'unavailable') return 'blocked';
        if (local?.status === 'degraded') return 'degraded';
        return serverStatus;
    };

    for (const definition of SAFE_DIRECT_CAPABILITIES) {
        if (!definition.tools.every(tool => authorized.has(tool))) continue;
        const status = effectiveStatus(definition.key);
        if (status === 'available') available.push(definition.label);
        if (status === 'degraded') {
            const local = definition.key === 'image_generation' || definition.key === 'video_generation'
                ? health[definition.key]
                : undefined;
            const retry = local?.retryAfterSeconds
                ? ` Retry in about ${local.retryAfterSeconds} seconds.`
                : ' Please retry later.';
            degraded.push(`${definition.label}.${retry}`);
        }
        if (status === 'blocked') blocked.push(definition.label);
        if (status === 'unverified') unverified.push(definition.label);
    }

    const specialists = [...new Set(input.registeredSpecialistIds)]
        .map(id => SAFE_SPECIALIST_LABELS[id])
        .filter((label): label is string => Boolean(label));
    const canRouteSpecialists = (
        authorized.has('consult_specialist') || authorized.has('delegate_task')
    ) && effectiveStatus('specialist_routing') === 'available';


    const lines = ['Here’s what I can do in this Boardroom right now:'];
    if (available.length > 0) lines.push(`- Available now: ${available.join(', ')}.`);
    if (specialists.length > 0 && canRouteSpecialists) {
        lines.push(`- Through qualified specialists: ${specialists.join(', ')}.`);
    }
    if (degraded.length > 0) lines.push(`- Temporarily unavailable: ${degraded.join(' ')}`);
    if (blocked.length > 0) lines.push(`- Not active right now: ${blocked.join(', ')}.`);
    if (unverified.length > 0) lines.push(`- Not verified right now: ${unverified.join(', ')}.`);
    if (
        input.snapshot.capabilities.social_publishing.status === 'available'
        && SOCIAL_PUBLISHING_TOOLS.some(tool => authorized.has(tool))
    ) {
        lines.push('- Requires your approval: publishing through a verified social connection.');
    }
    if (
        input.snapshot.capabilities.calendar_actions.status === 'available'
        && CALENDAR_ACTION_TOOLS.some(tool => authorized.has(tool))
    ) {
        lines.push('- Requires your approval: actions through a verified calendar connection.');
    }
    lines.push('- Not active in this session: direct banking transactions, rights-society registration, and DSP delivery. I can help prepare or review the work, but I will not claim an external submission without a verified connection and receipt.');
    return lines.join('\n');
}

export function buildDepartmentAuditReport(_options?: { query?: string }): string {
    return [
        'I can report current capabilities, but I cannot truthfully certify every department as fully implemented and production-operational from this fleet-level audit alone.',
        '',
        'The application has a configured specialist system spanning the major music-business departments, but implementation status, live provider connectivity, and production readiness are separate evidence questions.',
        '',
        '- I will not claim that all 23 departments are fully verified unless fresh runtime evidence proves that.',
        '- I will not claim there are no pending engineering items without checking the current repository/status evidence.',
        '- External actions such as DSP delivery, rights-society registration, social publishing, payments, and other provider operations require their own live credentials and receipts.',
        '- For a specific capability, I can report the current attested status as available, degraded, blocked, or unverified.',
        '',
        'For founder/internal use, open the status or error-report surfaces for the raw operational detail rather than relying on a blanket all-green statement.',
    ].join('\n');
}
export interface HallucinationDetectionResult {
    hasHallucination: boolean;
    matchedPattern?: string;
    snippet?: string;
}

const UNGROUNDED_ENGINEERING_PATTERNS: RegExp[] = [
    /\bholding pattern\b/i,
    /\bengineering sprint\b/i,
    /\bwaiting for (?:the |an? )?engineering\b/i,
    /\bengineering team has acknowledged receipt\b/i,
    /\bmaster technical specification document\b/i,
    /\bbuild phase has not yet yielded\b/i,
    /\bnone of the specialized tools(?: requested)?(?: by the department heads)? have been (?:implemented|delivered|deployed)\b/i,
    /\bnone of the tools have been (?:implemented|delivered|deployed)\b/i,
    /\boperating with their original,? baseline capabilities\b/i,
    /\bbaseline capabilities.{0,60}holding pattern\b/i,
    /\bholding pattern.{0,60}baseline capabilities\b/i,
    /\bboard-wide audit.{0,100}none of the (?:specialized )?tools\b/i,
    /\bholding pattern.{0,60}engineering sprint\b/i,
    /\bwaiting for.*engineering.*sprint\b/i,
    /\bno specialized tools have been deployed\b/i,
    /\bbuild phase has not yet yielded any deployed tools\b/i,
    /\btool deficit\b/i,
    /\bnine advanced tools(?: essential)?(?: for a professional-grade workflow)? are currently unavailable\b/i,
    /\boperations remain restricted to the core\b/i,
    /\btechnical roadmap remains unchanged\b/i,
    /\bawaits? (?:further )?engineering\b/i,
    /\bescalated to a human professional\b/i,
    /\bhave not been completed.{0,60}operations remain restricted\b/i,
];

export function detectUngroundedEngineeringHallucination(text: string): HallucinationDetectionResult {
    if (!text || typeof text !== 'string') {
        return { hasHallucination: false };
    }
    for (const pattern of UNGROUNDED_ENGINEERING_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
            return {
                hasHallucination: true,
                matchedPattern: pattern.source,
                snippet: match[0],
            };
        }
    }
    return { hasHallucination: false };
}

export function sanitizeAgentCapabilityOutput(output: string): string {
    const detection = detectUngroundedEngineeringHallucination(output);
    if (!detection.hasHallucination) {
        return output;
    }
    return buildDepartmentAuditReport();
}
