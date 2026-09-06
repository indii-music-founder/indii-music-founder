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

export function isCapabilityQuestion(task: string): boolean {
    const normalized = task.trim().replace(/[’]/g, "'").replace(/\s+/g, ' ');
    const subject = String.raw`(?:you|indii)`;

    return [
        new RegExp(String.raw`\bwhat can(?: and can(?:not|'t))? ${subject} do\b`, 'i'),
        new RegExp(String.raw`\bwhat (?:can(?:not|'t)|can't) ${subject} do\b`, 'i'),
        new RegExp(String.raw`\bwhat are (?:your|indii(?:'s)?) capabilit(?:y|ies)\b`, 'i'),
        new RegExp(String.raw`\b(?:tell|show|list|explain)(?: me)? (?:your|indii(?:'s)?) capabilit(?:y|ies)\b`, 'i'),
        new RegExp(String.raw`\b(?:what|which) tools? (?:do|can) ${subject} (?:have(?: access to)?|access|use)\b`, 'i'),
        new RegExp(String.raw`\b(?:do|can) ${subject} (?:have access to|access|use|have) (?:any |the )?tools?\b`, 'i'),
        new RegExp(String.raw`\bare (?:your|indii(?:'s)?) tools? (?:available|ready|working|accessible)(?: right now| now)?\b`, 'i'),
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
        tools: ['create_project', 'list_projects', 'list_files', 'search_files', 'search_knowledge'],
        key: 'durable_workspace',
        label: 'organize projects and find workspace material',
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
    director: 'creative direction',
    creative: 'creative direction & visual production',
    music: 'music and metadata review',
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
}): string {
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
        .filter((label): label is string => Boolean(label))
        .slice(0, 5);
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
