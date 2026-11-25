import { Globe, Layers, LayoutGrid, Radio, type LucideIcon } from 'lucide-react';
import type { BoardroomWorkspaceTab } from '@/core/store/slices/boardroomSlice';

export interface BoardroomWorkspaceTabDefinition {
    id: BoardroomWorkspaceTab;
    dockLabel: string;
    label: string;
    dockTitle: string;
    dockAriaLabel: string;
    dockTestId: string;
    icon: LucideIcon;
    iconColorClass: string;
}

export const BOARDROOM_WORKSPACE_TABS: readonly BoardroomWorkspaceTabDefinition[] = [
    {
        id: 'browser',
        dockLabel: 'Browser',
        label: 'Live Browser',
        dockTitle: 'Live Web Browser',
        dockAriaLabel: 'Toggle Live Browser',
        dockTestId: 'boardroom-workspace-toggle-browser',
        icon: Globe,
        iconColorClass: 'text-indigo-400',
    },
    {
        id: 'module',
        dockLabel: 'Studio',
        label: 'Studio Preview',
        dockTitle: 'In-Place Studio Module Preview',
        dockAriaLabel: 'Toggle Studio Module',
        dockTestId: 'boardroom-workspace-toggle-module',
        icon: LayoutGrid,
        iconColorClass: 'text-emerald-400',
    },
    {
        id: 'workbench',
        dockLabel: 'Workbench',
        label: 'Asset Workbench',
        dockTitle: 'Asset & Document Workbench',
        dockAriaLabel: 'Toggle Asset Workbench',
        dockTestId: 'boardroom-workspace-toggle-workbench',
        icon: Layers,
        iconColorClass: 'text-purple-400',
    },
    {
        id: 'agent-feed',
        dockLabel: 'Feed',
        label: 'Agent Live Feed',
        dockTitle: 'Agent workflow activity and handoffs',
        dockAriaLabel: 'Toggle agent activity feed',
        dockTestId: 'boardroom-workspace-toggle-feed',
        icon: Radio,
        iconColorClass: 'text-cyan-400',
    },
];
