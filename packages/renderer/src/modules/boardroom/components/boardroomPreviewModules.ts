import {
    Palette,
    Scale,
    DollarSign,
    Library,
    Target,
    Share2,
    Briefcase,
    PackageCheck,
    Key,
    GitBranch,
    FileText,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { ModuleId } from '@/core/constants';

interface ModuleOption {
    id: ModuleId;
    title: string;
    agentId: string;
    icon: ElementType;
}

export const PREVIEW_MODULES: readonly ModuleOption[] = [
    { id: 'creative', title: 'Creative Studio', agentId: 'creative', icon: Palette },
    { id: 'publishing', title: 'Publishing', agentId: 'publishing', icon: Library },
    { id: 'finance', title: 'Finance', agentId: 'finance', icon: DollarSign },
    { id: 'legal', title: 'Legal & Split Sheets', agentId: 'legal', icon: Scale },
    { id: 'marketing', title: 'Marketing', agentId: 'marketing', icon: Target },
    { id: 'social', title: 'Social Rollout', agentId: 'social', icon: Share2 },
    { id: 'brand', title: 'Brand Identity', agentId: 'brand', icon: Briefcase },
    { id: 'distribution', title: 'Distribution', agentId: 'distribution', icon: PackageCheck },
    { id: 'registration', title: 'Registration Center', agentId: 'registration', icon: Key },
    { id: 'licensing', title: 'Licensing', agentId: 'licensing', icon: Key },
    { id: 'workflow', title: 'Workflow Lab', agentId: 'workflow', icon: GitBranch },
    { id: 'notes', title: 'Founder Notes', agentId: 'notes', icon: FileText },
];
