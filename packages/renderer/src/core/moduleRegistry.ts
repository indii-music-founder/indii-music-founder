// ============================================================================
// Module Registry — single source of truth for generated navigation surfaces
// ============================================================================
// ISSUE-1438: the ⌘K command menu hardcoded ~22 entries while the app ships ~50
// registered modules (most of them reachable nowhere else). This registry derives
// the generated command-menu groups from MODULE_IDS so every module a user can
// access is discoverable from one place.
//
// Relationship to MODULE_DISPLAY_NAMES (constants.ts): that map names the page for
// the document outline (<h1>); the labels here are the user-facing nav names, which
// intentionally match the Sidebar (e.g. 'Road/tour', 'Marketing Department').

import {
    Activity, BarChart, Book, Briefcase, Building, CalendarDays, Camera, Clapperboard, ClipboardList,
    DollarSign, FileText, FolderOpen, Gem, History, LayoutDashboard, LayoutGrid, Library, Mic, Monitor,
    Music, Palette, PenTool, Scale, Server, Share2, Shield, ShoppingBag, Smartphone, Star, StickyNote,
    Target, Terminal, Users, type LucideIcon,
} from 'lucide-react';
import { type ModuleId } from './constants';

export type ModuleGroup =
    | "Manager's Office"
    | 'Departments'
    | 'Intelligence & Automations'
    | 'Tools'
    | 'Founders';

export const MODULE_GROUP_ORDER: ModuleGroup[] = [
    "Manager's Office",
    'Departments',
    'Intelligence & Automations',
    'Tools',
    'Founders',
];

export interface ModuleRegistryEntry {
    id: ModuleId;
    label: string;
    group: ModuleGroup;
    icon: LucideIcon;
}

/**
 * Modules excluded from generated navigation surfaces, with the reason.
 * These ids remain valid ModuleIds (routing, deep links, persisted state),
 * they are just not offered as destinations here.
 */
export const HIDDEN_MODULE_REASONS: Partial<Record<ModuleId, string>> = {
    // ISSUE-1436: rendered the identical CampaignDashboard as Marketing — one entry only.
    'campaign': 'duplicate of Marketing Department',
    // ISSUE-1441 (redundancy audit): the former phantom ids 'audio-analyzer' and
    // 'format-foundry' were fully removed. Legacy /audio-analyzer and
    // /format-foundry URLs still redirect via useURLSync ROUTE_ALIASES.
    // Internal ops surfaces (god-mode command menu carries observability directly).
    'observability': 'internal ops dashboard',
    'devops': 'internal ops dashboard',
    // Flow/utility shells the app navigates to itself — not destinations to choose.
    'select-org': 'organization selection flow',
    'onboarding': 'onboarding flow',
    'investor': 'investor deep link',
    'capture': 'standalone capture deep link',
    'mobile-remote': 'phone remote shell (/remote)',
    'desktop': 'desktop shell',
    'video-popout': 'video popout window',
    'founders-portal': 'post-checkout deep link',
    // Deliberate, prominent dedicated entry ("Back the Vision") — avoid a duplicate.
    'founders-checkout': 'dedicated founders CTA',
};

const REGISTRY: Record<ModuleId, ModuleRegistryEntry> = {
    // Manager's Office
    'brand': { id: 'brand', label: 'Brand Manager', group: "Manager's Office", icon: Briefcase },
    'road': { id: 'road', label: 'Road/tour', group: "Manager's Office", icon: Users },
    'agent': { id: 'agent', label: 'Booking Agent', group: "Manager's Office", icon: CalendarDays },
    'publicist': { id: 'publicist', label: 'Publicist', group: "Manager's Office", icon: Mic },
    'creative': { id: 'creative', label: 'Creative Director', group: "Manager's Office", icon: Palette },
    // Departments
    'marketing': { id: 'marketing', label: 'Marketing Department', group: 'Departments', icon: Target },
    'social': { id: 'social', label: 'Social Media Department', group: 'Departments', icon: Share2 },
    'legal': { id: 'legal', label: 'Legal Department', group: 'Departments', icon: Scale },
    'publishing': { id: 'publishing', label: 'Publishing Department', group: 'Departments', icon: Library },
    'finance': { id: 'finance', label: 'Finance Department', group: 'Departments', icon: DollarSign },
    'distribution': { id: 'distribution', label: 'Distribution Department', group: 'Departments', icon: Music },
    'licensing': { id: 'licensing', label: 'Licensing Department', group: 'Departments', icon: FileText },
    'merch': { id: 'merch', label: 'Art & Merch Dept', group: 'Departments', icon: ShoppingBag },
    'registration': { id: 'registration', label: 'Registration Center', group: 'Departments', icon: ClipboardList },
    'security': { id: 'security', label: 'Security Agent', group: 'Departments', icon: Shield },
    // Intelligence & Automations
    'workflow': { id: 'workflow', label: 'Workflow Builder', group: 'Intelligence & Automations', icon: Book },
    'knowledge': { id: 'knowledge', label: 'Knowledge Base', group: 'Intelligence & Automations', icon: Book },
    // Tools
    'dashboard': { id: 'dashboard', label: 'Home', group: 'Tools', icon: LayoutDashboard },
    'files': { id: 'files', label: 'Files', group: 'Tools', icon: FolderOpen },
    'notes': { id: 'notes', label: 'Notes', group: 'Tools', icon: StickyNote },
    'history': { id: 'history', label: 'History & Vault', group: 'Tools', icon: History },
    'settings': { id: 'settings', label: 'Settings', group: 'Tools', icon: PenTool },
    'analytics': { id: 'analytics', label: 'Analytics', group: 'Tools', icon: BarChart },
    'crm': { id: 'crm', label: 'CRM', group: 'Tools', icon: Users },
    'screenwriter': { id: 'screenwriter', label: 'Screenwriter', group: 'Tools', icon: Clapperboard },
    'project-canvas': { id: 'project-canvas', label: 'Project Canvas', group: 'Tools', icon: LayoutGrid },
    'memory': { id: 'memory', label: 'Memory', group: 'Tools', icon: Server },
    'marketplace': { id: 'marketplace', label: 'Marketplace', group: 'Tools', icon: ShoppingBag },
    'raw-converter': { id: 'raw-converter', label: 'RAW Converter', group: 'Tools', icon: Camera },
    'debug': { id: 'debug', label: 'Debug', group: 'Tools', icon: Terminal },
    // Founders
    'founders-recognition': { id: 'founders-recognition', label: 'Founders', group: 'Founders', icon: Star },
    'founders-checkout': { id: 'founders-checkout', label: 'Back the Vision', group: 'Founders', icon: Gem },
    'founders-portal': { id: 'founders-portal', label: 'Founder Portal', group: 'Founders', icon: Gem },
    // Hidden-only entries (kept so the Record covers every ModuleId at compile time).
    'campaign': { id: 'campaign', label: 'Campaign Manager', group: "Manager's Office", icon: Target },
    'observability': { id: 'observability', label: 'Observability', group: 'Tools', icon: Activity },
    'devops': { id: 'devops', label: 'DevOps', group: 'Tools', icon: Server },
    'select-org': { id: 'select-org', label: 'Select Organization', group: 'Tools', icon: Building },
    'onboarding': { id: 'onboarding', label: 'Onboarding', group: 'Tools', icon: Book },
    'investor': { id: 'investor', label: 'Investor', group: 'Tools', icon: DollarSign },
    'capture': { id: 'capture', label: 'Capture', group: 'Tools', icon: Camera },
    'mobile-remote': { id: 'mobile-remote', label: 'Mobile Remote', group: 'Tools', icon: Smartphone },
    'desktop': { id: 'desktop', label: 'Desktop', group: 'Tools', icon: Monitor },
    'video-popout': { id: 'video-popout', label: 'Video Popout', group: 'Tools', icon: Music },
};

/**
 * Modules offered as destinations on generated navigation surfaces, grouped in
 * MODULE_GROUP_ORDER with labels sorted alphabetically inside each group.
 * Callers additionally filter by runtime gating (useGatedModules) and
 * organization access (canAccessModule).
 */
export function getCommandMenuModules(): { group: ModuleGroup; items: ModuleRegistryEntry[] }[] {
    const visible = Object.values(REGISTRY).filter(entry => !HIDDEN_MODULE_REASONS[entry.id]);
    return MODULE_GROUP_ORDER
        .map(group => ({
            group,
            items: visible
                .filter(entry => entry.group === group)
                .sort((a, b) => a.label.localeCompare(b.label)),
        }))
        .filter(section => section.items.length > 0);
}
