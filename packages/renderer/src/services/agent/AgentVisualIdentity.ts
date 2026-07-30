import {
    DEPARTMENTS,
    getDepartmentOf,
    isHead,
    isWorker,
} from './departments';

export type AgentVisualRole = 'head' | 'worker' | 'independent' | 'unknown';

export type AgentVisualIconKey =
    | 'bot'
    | 'briefcase-business'
    | 'calculator'
    | 'calendar-days'
    | 'camera'
    | 'clapperboard'
    | 'cloud-cog'
    | 'graduation-cap'
    | 'handshake'
    | 'landmark'
    | 'library'
    | 'lock-keyhole'
    | 'megaphone'
    | 'music-2'
    | 'palette'
    | 'pen-line'
    | 'route'
    | 'scale'
    | 'share-2'
    | 'shield-check'
    | 'sparkles'
    | 'utensils'
    | 'video';

export type AgentVisualCssProperties = Readonly<Record<
    | '--agent-source-accent'
    | '--agent-accent'
    | '--agent-surface'
    | '--agent-border'
    | '--agent-glow'
    | '--agent-foreground'
    | '--agent-on-accent-foreground',
    string
>>;

export interface AgentVisualIdentity {
    readonly agentId: string;
    readonly displayName: string;
    readonly initials: string;
    readonly iconKey: AgentVisualIconKey;
    readonly departmentId: string | null;
    readonly role: AgentVisualRole;
    /** Opaque numeric colors. Decorative glow is the sole non-opaque token. */
    readonly accent: string;
    readonly surface: string;
    readonly border: string;
    readonly glow: string;
    readonly foreground: string;
    readonly onAccentForeground: string;
    readonly ariaLabel: string;
    readonly cssProperties: AgentVisualCssProperties;
}

export interface ResolveAgentVisualIdentityOptions {
    /** Explicit alias for an independent integration or otherwise unknown ID. */
    readonly displayName?: string;
}

interface VisualAlias {
    readonly displayName: string;
    readonly iconKey: AgentVisualIconKey;
}

interface SourcePalette {
    readonly cssVariable: string;
    readonly hex: string;
}

const HEAD_ALIASES: Readonly<Record<string, VisualAlias>> = Object.freeze({
    finance: { displayName: 'Finance Director', iconKey: 'landmark' },
    legal: { displayName: 'Legal Director', iconKey: 'scale' },
    distribution: { displayName: 'Distribution Director', iconKey: 'route' },
    marketing: { displayName: 'Marketing Director', iconKey: 'megaphone' },
    brand: { displayName: 'Brand Director', iconKey: 'briefcase-business' },
    music: { displayName: 'Music Director', iconKey: 'music-2' },
    video: { displayName: 'Video Director', iconKey: 'video' },
    social: { displayName: 'Social Media Director', iconKey: 'share-2' },
    publicist: { displayName: 'Publicist', iconKey: 'megaphone' },
    publishing: { displayName: 'Publishing Director', iconKey: 'library' },
    licensing: { displayName: 'Licensing Director', iconKey: 'handshake' },
    road: { displayName: 'Road Director', iconKey: 'route' },
    hospitality: { displayName: 'Hospitality Coordinator', iconKey: 'utensils' },
    'event-planner': { displayName: 'Event Production Director', iconKey: 'calendar-days' },
    merchandise: { displayName: 'Merchandise Specialist', iconKey: 'briefcase-business' },
    creative: { displayName: 'Creative Director', iconKey: 'palette' },
    producer: { displayName: 'Production Director', iconKey: 'clapperboard' },
    director: { displayName: 'Visual Director', iconKey: 'camera' },
    screenwriter: { displayName: 'Screenwriting Director', iconKey: 'pen-line' },
    devops: { displayName: 'DevOps Director', iconKey: 'cloud-cog' },
    security: { displayName: 'Security Director', iconKey: 'shield-check' },
    curriculum: { displayName: 'Music Education Specialist', iconKey: 'graduation-cap' },
    keeper: { displayName: 'Keeper', iconKey: 'lock-keyhole' },
});

const WORKER_ALIASES: Readonly<Record<string, VisualAlias>> = Object.freeze({
    'finance.accounting': { displayName: 'Accounting Specialist', iconKey: 'calculator' },
    'finance.tax': { displayName: 'Tax Specialist', iconKey: 'calculator' },
    'finance.royalty': { displayName: 'Royalty Specialist', iconKey: 'landmark' },
    'legal.contracts': { displayName: 'Contracts Specialist', iconKey: 'pen-line' },
    'legal.compliance': { displayName: 'Compliance Specialist', iconKey: 'shield-check' },
});

const INDEPENDENT_ALIASES: Readonly<Record<string, VisualAlias>> = Object.freeze({
    generalist: { displayName: 'indii Conductor', iconKey: 'sparkles' },
    analytics: { displayName: 'Analytics Director', iconKey: 'calculator' },
    rights: { displayName: 'Rights & Registration Director', iconKey: 'shield-check' },
});

/**
 * These are the numeric sources for the established CSS variables in index.css.
 * Aliased departments intentionally share the same palette rather than inventing
 * a runtime-, provider-, model-, or session-derived color.
 */
const SOURCE_PALETTES = Object.freeze({
    royalties: { cssVariable: '--color-dept-royalties', hex: '#FFC107' },
    distribution: { cssVariable: '--color-dept-distribution', hex: '#2196F3' },
    marketing: { cssVariable: '--color-dept-marketing', hex: '#E91E63' },
    legal: { cssVariable: '--color-dept-legal', hex: '#455A64' },
    creative: { cssVariable: '--color-dept-creative', hex: '#00FF66' },
    touring: { cssVariable: '--color-dept-touring', hex: '#FF5722' },
    publishing: { cssVariable: '--color-dept-publishing', hex: '#8BC34A' },
    social: { cssVariable: '--color-dept-social', hex: '#00BCD4' },
    licensing: { cssVariable: '--color-dept-licensing', hex: '#009688' },
    brand: { cssVariable: '--color-dept-brand', hex: '#FFB300' },
    campaign: { cssVariable: '--color-dept-campaign', hex: '#FF7043' },
    default: { cssVariable: '--color-dept-default', hex: '#00FF66' },
    neutral: { cssVariable: '--color-dept-neutral', hex: '#94A3B8' },
} satisfies Readonly<Record<string, SourcePalette>>);

type PaletteKey = keyof typeof SOURCE_PALETTES;

const DEPARTMENT_PALETTE: Readonly<Record<string, PaletteKey>> = Object.freeze({
    finance: 'royalties',
    legal: 'legal',
    distribution: 'distribution',
    marketing: 'marketing',
    brand: 'brand',
    music: 'creative',
    video: 'creative',
    social: 'social',
    publicist: 'marketing',
    publishing: 'publishing',
    licensing: 'licensing',
    road: 'touring',
    hospitality: 'touring',
    'event-planner': 'campaign',
    merchandise: 'brand',
    creative: 'creative',
    producer: 'creative',
    director: 'creative',
    screenwriter: 'creative',
    devops: 'distribution',
    security: 'legal',
    curriculum: 'default',
    keeper: 'default',
});

const INDEPENDENT_PALETTE: Readonly<Record<string, PaletteKey>> = Object.freeze({
    generalist: 'default',
    analytics: 'distribution',
    rights: 'licensing',
});

const CANVAS = '#080A0D';
const TEXT = '#F8FAFC';
const DARK_TEXT = '#050608';
const NORMAL_TEXT_CONTRAST = 4.5;
const UI_CONTRAST = 3;

export function resolveAgentVisualIdentity(
    agentId: string | null | undefined,
    options: ResolveAgentVisualIdentityOptions = {},
): AgentVisualIdentity {
    const normalizedId = normalizeAgentId(agentId);
    const explicitName = cleanDisplayName(options.displayName);
    const department = getDepartmentOf(normalizedId);
    const role: AgentVisualRole = isHead(normalizedId)
        ? 'head'
        : isWorker(normalizedId)
            ? 'worker'
            : INDEPENDENT_ALIASES[normalizedId] || explicitName
                ? 'independent'
                : 'unknown';
    const alias = role === 'head'
        ? HEAD_ALIASES[normalizedId]
        : role === 'worker'
            ? WORKER_ALIASES[normalizedId]
            : INDEPENDENT_ALIASES[normalizedId];
    const applicableExplicitName = alias ? undefined : explicitName;
    const displayName = alias?.displayName
        ?? applicableExplicitName
        ?? (role === 'worker' && department
            ? `${titleCase(normalizedId.split('.').at(-1) ?? 'Worker')} Specialist`
            : 'Unknown Agent');
    const iconKey = alias?.iconKey ?? (role === 'worker' ? 'bot' : 'bot');
    const paletteKey = department
        ? DEPARTMENT_PALETTE[department.id] ?? 'default'
        : INDEPENDENT_PALETTE[normalizedId] ?? 'neutral';
    const palette = SOURCE_PALETTES[paletteKey];
    const surface = mixHex(CANVAS, palette.hex, role === 'worker' ? 0.08 : 0.13);
    const accessibleHeadAccent = ensureContrast(palette.hex, surface, NORMAL_TEXT_CONTRAST);
    const accent = role === 'worker'
        ? reduceToContrast(accessibleHeadAccent, surface, UI_CONTRAST + 0.15)
        : accessibleHeadAccent;
    const border = accent;
    const foreground = TEXT;
    const onAccentForeground = pickForeground(accent);
    const glowAlpha = role === 'worker' ? 0.18 : role === 'unknown' ? 0.16 : 0.28;
    const glow = toRgba(accent, glowAlpha);
    const departmentId = department?.id ?? null;
    const initials = makeInitials(displayName);
    const roleLabel = role === 'head'
        ? `${department?.displayName ?? displayName} department head`
        : role === 'worker'
            ? `${department?.displayName ?? 'Department'} worker`
            : role === 'unknown'
                ? 'neutral fallback identity'
                : 'independent agent';
    const ariaLabel = `${displayName}, ${roleLabel}`;
    const cssProperties = Object.freeze({
        '--agent-source-accent': `var(${palette.cssVariable}, ${palette.hex})`,
        '--agent-accent': accent,
        '--agent-surface': surface,
        '--agent-border': border,
        '--agent-glow': glow,
        '--agent-foreground': foreground,
        '--agent-on-accent-foreground': onAccentForeground,
    }) satisfies AgentVisualCssProperties;

    const identity = Object.freeze({
        agentId: normalizedId,
        displayName,
        initials,
        iconKey,
        departmentId,
        role,
        accent,
        surface,
        border,
        glow,
        foreground,
        onAccentForeground,
        ariaLabel,
        cssProperties,
    }) satisfies AgentVisualIdentity;

    return identity;
}

/** WCAG contrast ratio for opaque #RRGGBB tokens. */
export function getAgentColorContrast(foreground: string, background: string): number {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

function normalizeAgentId(agentId: string | null | undefined): string {
    const normalized = agentId?.trim().toLowerCase();
    return normalized || 'unknown';
}

function cleanDisplayName(displayName: string | undefined): string | undefined {
    const cleaned = displayName?.trim().replace(/\s+/g, ' ');
    return cleaned || undefined;
}

function makeInitials(displayName: string): string {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

function titleCase(value: string): string {
    return value
        .split(/[-_.\s]+/)
        .filter(Boolean)
        .map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
        .join(' ');
}

function ensureContrast(color: string, background: string, minimum: number): string {
    if (getAgentColorContrast(color, background) >= minimum) return normalizeHex(color);
    for (let step = 1; step <= 20; step += 1) {
        const candidate = mixHex(color, '#FFFFFF', step / 20);
        if (getAgentColorContrast(candidate, background) >= minimum) return candidate;
    }
    return '#FFFFFF';
}

function reduceToContrast(color: string, background: string, minimum: number): string {
    let candidate = normalizeHex(color);
    for (let step = 1; step <= 20; step += 1) {
        const next = mixHex(color, background, step / 40);
        if (getAgentColorContrast(next, background) < minimum) return candidate;
        candidate = next;
    }
    return candidate;
}

function pickForeground(background: string): string {
    const darkContrast = getAgentColorContrast(DARK_TEXT, background);
    const lightContrast = getAgentColorContrast(TEXT, background);
    return darkContrast >= lightContrast ? DARK_TEXT : TEXT;
}

function relativeLuminance(color: string): number {
    const [red, green, blue] = hexToRgb(color).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function mixHex(from: string, to: string, amount: number): string {
    const fromRgb = hexToRgb(from);
    const toRgb = hexToRgb(to);
    return rgbToHex(
        Math.round(fromRgb[0]! + (toRgb[0]! - fromRgb[0]!) * amount),
        Math.round(fromRgb[1]! + (toRgb[1]! - fromRgb[1]!) * amount),
        Math.round(fromRgb[2]! + (toRgb[2]! - fromRgb[2]!) * amount),
    );
}

function normalizeHex(color: string): string {
    const [red, green, blue] = hexToRgb(color);
    return rgbToHex(red!, green!, blue!);
}

function hexToRgb(color: string): [number, number, number] {
    const match = /^#([0-9a-f]{6})$/i.exec(color);
    if (!match) throw new Error(`Expected opaque #RRGGBB color, received "${color}"`);
    const value = Number.parseInt(match[1]!, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
        .map(channel => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
}

function toRgba(color: string, alpha: number): string {
    const [red, green, blue] = hexToRgb(color);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// Guard the visual policy against silently drifting away from the canonical
// ISSUE-1291 roster authority.
for (const department of Object.values(DEPARTMENTS)) {
    if (!HEAD_ALIASES[department.headId]) {
        throw new Error(`Missing visual alias for canonical department head "${department.headId}"`);
    }
}
