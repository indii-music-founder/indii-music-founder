import { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { memoryService } from '@/services/agent/MemoryService';
import { 
    Sparkles, 
    Play, 
    History, 
    TrendingUp, 
    UserPlus,
    type LucideIcon 
} from 'lucide-react';
import { logger } from '@/utils/logger';

export type UserScenario = 'new-user' | 'returning-active' | 'returning-stale';

export interface QuickAction {
    id: string;
    label: string;
    prompt: string | null;
    action?: () => void;
    icon: LucideIcon;
    variant: 'primary' | 'secondary';
}

export interface EntryContext {
    scenario: UserScenario;
    userName: string;
    lastSessionTitle: string | null;
    lastSessionId: string | null;
    lastSessionAge: number | null;
    memoryContext: string | null;
    suggestedActions: QuickAction[];
    isLoading: boolean;
}

/**
 * useEntryContext - Orchestrates the intelligent greeting and contextual 
 * actions for the Agent Workspace entry point.
 */
export function useEntryContext(): EntryContext {
    const { sessions, userProfile, currentOrganizationId } = useStore(
        useShallow((s) => ({
            sessions: s.sessions,
            userProfile: s.userProfile,
            currentOrganizationId: s.currentOrganizationId,
        }))
    );

    const [memoryContext, setMemoryContext] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const sessionList = Object.values(sessions);
    const mostRecent = [...sessionList]
        .filter((s) => !s.namespace)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    const isNew = sessionList.length === 0 && userProfile.displayName === 'New Artist';
    const lastUpdateAge = mostRecent ? Date.now() - mostRecent.updatedAt : null;
    const isStale = lastUpdateAge ? lastUpdateAge > 7 * 86_400_000 : true;

    const scenario: UserScenario = isNew 
        ? 'new-user' 
        : (mostRecent && !isStale) 
            ? 'returning-active' 
            : 'returning-stale';

    useEffect(() => {
        let isMounted = true;

        async function loadContext() {
            if (!currentOrganizationId || currentOrganizationId === 'org-default') {
                setIsLoading(false);
                return;
            }

            try {
                // Fetch recent high-priority memories to inject into greeting
                const results = await memoryService.retrieveRelevantMemories(
                    currentOrganizationId,
                    'recent activity and current focus',
                    1
                );
                
                if (isMounted && results.length > 0) {
                    setMemoryContext(results[0]!);
                }
            } catch (err) {
                logger.error('[useEntryContext] Memory retrieval failed:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        loadContext();
        return () => { isMounted = false; };
    }, [currentOrganizationId]);

    // Build suggested actions based on context
    const suggestedActions: QuickAction[] = [];

    if (scenario === 'new-user') {
        suggestedActions.push(
            { id: 'brand-kit', label: 'Setup Brand Kit', prompt: 'Help me set up my brand kit and artist identity.', icon: UserPlus, variant: 'primary' },
            { id: 'tour', label: 'Take a Tour', prompt: 'Show me around the studio and tell me what you can do.', icon: Sparkles, variant: 'secondary' }
        );
    } else if (scenario === 'returning-active' && mostRecent) {
        suggestedActions.push(
            { id: 'continue', label: `Resume: ${mostRecent.title}`, prompt: `Let's pick up where we left off on ${mostRecent.title}.`, icon: Play, variant: 'primary' },
            { id: 'stats', label: 'Check Stats', prompt: 'Show me my latest performance stats and royalty estimates.', icon: TrendingUp, variant: 'secondary' },
            { id: 'royalties', label: 'Check Royalties', prompt: 'How much royalty income did I earn last month across all platforms?', icon: TrendingUp, variant: 'secondary' }
            { id: 'stats', label: 'Check Stats', prompt: 'Show me my latest performance stats and royalty estimates.', icon: TrendingUp, variant: 'secondary' }
        );
    } else {
        suggestedActions.push(
            { id: 'new-task', label: 'Start New Task', prompt: 'I want to start a new project.', icon: Sparkles, variant: 'primary' },
            { id: 'history', label: 'View History', prompt: null, action: () => useStore.setState({ rightPanelTab: 'agent', rightPanelView: 'archives', isRightPanelOpen: true }), icon: History, variant: 'secondary' },
            { id: 'trends', label: 'Analyze Trends', prompt: 'What are the current trending sounds and visual styles in my genre right now?', icon: TrendingUp, variant: 'secondary' }
            { id: 'history', label: 'View History', prompt: null, action: () => useStore.setState({ rightPanelTab: 'agent', rightPanelView: 'archives', isRightPanelOpen: true }), icon: History, variant: 'secondary' }
        );
    }

    return {
        scenario,
        userName: userProfile.displayName || 'Artist',
        lastSessionTitle: mostRecent?.title || null,
        lastSessionId: mostRecent?.id || null,
        lastSessionAge: lastUpdateAge ? Math.floor(lastUpdateAge / 86_400_000) : null,
        memoryContext,
        suggestedActions,
        isLoading
    };
}
