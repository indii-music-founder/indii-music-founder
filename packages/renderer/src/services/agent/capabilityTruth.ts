import { getToolRiskMetadata } from './ToolRiskRegistry';

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
    return /\b(what can (you|indii)|what (can'?t|cannot) (you|indii)|capabilit(?:y|ies)|tools?.*(?:have|access)|mcp|apis?.*(?:have|access))\b/i.test(task);
}

const SAFE_DIRECT_CAPABILITIES = [
    { tools: ['create_project', 'list_projects'], label: 'organize projects and plans' },
    { tools: ['list_files', 'search_files', 'search_knowledge'], label: 'find workspace files and knowledge' },
    { tools: ['save_memory', 'recall_memories'], label: 'save and recall approved workspace context' },
] as const;

const SAFE_SPECIALIST_LABELS: Record<string, string> = {
    finance: 'finance analysis',
    legal: 'contract review',
    distribution: 'release-readiness guidance',
    marketing: 'marketing planning',
    director: 'creative direction',
    music: 'music and metadata review',
};

export function buildCapabilitySummary(input: {
    authorizedTools: string[];
    registeredSpecialistIds: string[];
    health?: Partial<Record<CapabilityHealthKey, CapabilityHealth>>;
}): string {
    const authorized = new Set(input.authorizedTools);
    const health = input.health ?? {};
    const available: string[] = [];
    const degraded: string[] = [];

    for (const definition of SAFE_DIRECT_CAPABILITIES) {
        if (definition.tools.some(tool => authorized.has(tool))) available.push(definition.label);
    }

    const mediaDefinitions = [
        { tool: 'generate_image', healthKey: 'image_generation' as const, label: 'create images' },
        { tool: 'generate_video', healthKey: 'video_generation' as const, label: 'create videos' },
    ];
    for (const media of mediaDefinitions) {
        if (!authorized.has(media.tool)) continue;
        const currentHealth = health[media.healthKey];
        if (currentHealth?.status === 'degraded' || currentHealth?.status === 'unavailable') {
            const retry = currentHealth.retryAfterSeconds
                ? ` Retry in about ${currentHealth.retryAfterSeconds} seconds.`
                : ' Please retry later.';
            degraded.push(`${media.label}${retry}`);
        } else {
            available.push(media.label);
        }
    }

    const specialists = [...new Set(input.registeredSpecialistIds)]
        .map(id => SAFE_SPECIALIST_LABELS[id])
        .filter((label): label is string => Boolean(label))
        .slice(0, 5);

    const approvalCapabilities = input.authorizedTools
        .filter(tool => getToolRiskMetadata(tool).requiresApproval)
        .map(tool => {
            const metadata = getToolRiskMetadata(tool);
            return metadata.riskTier === 'destructive'
                ? 'irreversible or external actions'
                : 'sensitive connected actions';
        });

    const lines = ['Here’s what I can do in this Boardroom right now:'];
    if (available.length > 0) lines.push(`- Available now: ${available.join(', ')}.`);
    if (specialists.length > 0 && health.specialist_routing?.status !== 'unavailable') {
        lines.push(`- Through qualified specialists: ${specialists.join(', ')}.`);
    }
    if (approvalCapabilities.length > 0) {
        lines.push(`- Requires your approval: ${[...new Set(approvalCapabilities)].join(' and ')}.`);
    }
    if (degraded.length > 0 || health.specialist_routing?.status === 'unavailable') {
        const unavailable = [
            ...degraded,
            ...(health.specialist_routing?.status === 'unavailable'
                ? ['specialist routing. Please retry later.']
                : []),
        ];
        lines.push(`- Temporarily unavailable: ${unavailable.join(' ')}`);
    }
    lines.push('- Not active in this session: direct banking transactions, rights-society registration, and DSP delivery. I can help prepare or review the work, but I will not claim an external submission without a verified connection and receipt.');
    return lines.join('\n');
}
