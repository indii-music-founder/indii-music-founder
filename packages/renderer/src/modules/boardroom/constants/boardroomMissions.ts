import {
    DollarSign,
    Music2,
    PackageCheck,
    Palette,
    Scale,
    Target,
    type LucideIcon,
} from 'lucide-react';
import type { BoardroomExecutiveMission } from '@/config/typesafeJudgments';

export interface BoardroomMissionDefinition {
    id: BoardroomExecutiveMission;
    starterCardId?: string;
    label: string;
    description: string;
    badge: string;
    starterAccentColor?: string;
    agentIds: string[];
    prompt: string;
    icon: LucideIcon;
}

export const BOARDROOM_MISSIONS: readonly BoardroomMissionDefinition[] = [
    {
        id: 'master_audit',
        starterCardId: 'master-audit',
        label: 'Master Audio & Golden Metadata',
        description: 'Extract Audio DNA, verify ISRC, and check DDEX streaming readiness.',
        badge: 'Music + Distribution',
        starterAccentColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:border-cyan-400/50',
        agentIds: ['music', 'distribution'],
        prompt: 'Audit my latest master recording: extract Audio DNA, verify ISRC, and check DDEX readiness.',
        icon: Music2,
    },
    {
        id: 'split_rights',
        starterCardId: 'split-sheet',
        label: 'Draft Split Sheet & Clear Rights',
        description: 'Verify 50/50 splits, sample clearances, and draft collaborator contracts.',
        badge: 'Legal + Finance',
        starterAccentColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:border-amber-400/50',
        agentIds: ['legal', 'finance'],
        prompt: 'Draft a standard 50/50 co-writer split sheet for my current track and check for sample clearance hurdles.',
        icon: Scale,
    },
    {
        id: 'royalty_waterfall',
        starterCardId: 'royalty-waterfall',
        label: 'Recoupment & Waterfall Modeling',
        description: 'Model streaming recoupment, publishing dividends, and manager fee savings.',
        badge: 'Finance Chief',
        starterAccentColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400/50',
        agentIds: ['finance'],
        prompt: 'Model our distribution and publishing royalty waterfall to calculate recoupment and net earnings.',
        icon: DollarSign,
    },
    {
        id: 'ddex_catalog',
        starterCardId: 'ddex-catalog',
        label: 'Catalog Audit & DDEX Delivery',
        description: 'Audit catalog gaps, generate BWARM reports, and stage DSP releases.',
        badge: 'Distribution + Publishing',
        starterAccentColor: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-400/50',
        agentIds: ['distribution', 'publishing'],
        prompt: 'Inspect my catalog for missing metadata gaps and prepare staged DDEX release payloads.',
        icon: PackageCheck,
    },
    {
        id: 'campaign_swarm',
        label: 'Release Campaign & Social Rollout',
        description: 'Synchronize 4-week marketing, social reels, and brand positioning.',
        badge: 'Marketing + Social + Brand',
        agentIds: ['marketing', 'social', 'brand'],
        prompt: 'Build a synchronized 4-week release rollout across Marketing, Social, and Brand strategy.',
        icon: Target,
    },
    {
        id: 'creative_sync',
        label: 'Creative & Visual Direction Sync',
        description: 'Align cover art, canvas visuals, and video teasers with seated directors.',
        badge: 'Creative + Video + Brand',
        agentIds: ['creative', 'video', 'brand'],
        prompt: 'Review our pinned visual assets and align cover art, canvas visuals, and video teasers.',
        icon: Palette,
    },
];
