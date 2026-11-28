import type { LucideIcon } from 'lucide-react';
import { Activity, BookOpen, Bot, Calendar, CheckSquare, DollarSign, FolderOpen, HardDrive, Layers, MapPin, Music, Palette, ShieldCheck, ShoppingBag, ThumbsUp, TrendingUp, Users } from 'lucide-react';

/**
 * Dashboard widget types and their picker metadata.
 * Renderers live in CustomDashboardWidgets.tsx (WIDGET_RENDERERS).
 */
export type WidgetType =
    | 'streams_today'
    | 'revenue_consolidated'
    | 'project_timeline'
    | 'approval_gates'
    | 'next_release'
    | 'top_track'
    | 'agent_activity'
    | 'audience_growth'
    | 'active_campaigns'
    | 'pending_tasks'
    | 'social_engagement'
    | 'brand_identity'
    | 'merch_sales'
    | 'tour_status'
    | 'cost_estimator'
    | 'recent_projects'
    | 'workspace_stats'
    | 'storage_usage'
    | 'knowledge_base';

export interface Widget {
    id: string;
    type: WidgetType;
    order: number;
}

export const WIDGET_DEFINITIONS: Record<WidgetType, { label: string; icon: LucideIcon; description: string; deprecated?: boolean }> = {
    streams_today: { label: 'Streams Today', icon: Music, description: 'Daily stream count across all DSPs' },
    revenue_consolidated: { label: 'Revenue & Royalties', icon: DollarSign, description: 'Consolidated gross revenue, MTD earnings and income sources' },
    project_timeline: { label: 'Project Timeline', icon: Calendar, description: 'Active rollout timeline, current phase, and milestone countdown' },
    approval_gates: { label: 'Approval Gates', icon: ShieldCheck, description: 'Pending approval gates and one-click authorization' },
    next_release: { label: 'Next Release', icon: Calendar, description: 'Countdown to your next scheduled release' },
    top_track: { label: 'Top Track', icon: TrendingUp, description: 'Your best performing track right now' },
    agent_activity: { label: 'Agent Activity', icon: Bot, description: 'Recent tasks your team finished' },
    audience_growth: { label: 'Audience Growth', icon: Users, description: 'New listeners and followers across platforms' },
    active_campaigns: { label: 'Active Campaigns', icon: Activity, description: 'Currently running marketing campaigns' },
    pending_tasks: { label: 'Pending Tasks', icon: CheckSquare, description: 'Tasks requiring your attention' },
    social_engagement: { label: 'Social Engagement', icon: ThumbsUp, description: 'Likes, comments, and shares on recent posts' },
    brand_identity: { label: 'Brand Integrity', icon: Palette, description: 'Visual identity and brand compliance scores' },
    merch_sales: { label: 'Merchandise', icon: ShoppingBag, description: 'Recent sales and inventory alerts' },
    tour_status: { label: 'Tour & Shows', icon: MapPin, description: 'Ticket sales and upcoming tour dates' },
    cost_estimator: { label: 'Cost Estimator', icon: DollarSign, description: 'Estimate generation costs' },
    recent_projects: { label: 'Recent Projects', icon: FolderOpen, description: 'Jump back into your latest projects or start a new one' },
    workspace_stats: { label: 'Workspace Stats', icon: Layers, description: 'Projects, agent conversations, and storage at a glance' },
    storage_usage: { label: 'Storage', icon: HardDrive, description: 'How your storage splits across images, video, and knowledge files' },
    knowledge_base: { label: 'Knowledge Base', icon: BookOpen, description: 'Documents you have added for your team to reference' },
};
