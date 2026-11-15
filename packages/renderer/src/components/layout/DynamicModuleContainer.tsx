import React, { Suspense, useState, useEffect } from 'react';
import {
    judgeDynamicDashboardLayout,
    type DynamicComponentKey,
    type LayoutContextData,
} from '@/config/typesafeJudgments';

export type { DynamicComponentKey, LayoutContextData };

// ---------------------------------------------------------------------------
// Component Registry Definition
// Concrete, valid React components for the dynamic assembler
// ---------------------------------------------------------------------------

function StemInspectorWidget(props: Record<string, unknown>) {
    return (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white tracking-wide uppercase">Stem Audio Inspector</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">Not inspected</span>
            </div>
            <p className="text-xs text-slate-400">No stem inspection result is attached to this card.</p>
            {Boolean(props.activeReleaseType) && (
                <div className="text-[10px] text-slate-500 mt-1">Release Type: {String(props.activeReleaseType)}</div>
            )}
        </div>
    );
}

function RoyaltySplitTableWidget(props: Record<string, unknown>) {
    return (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-amber-500/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200 tracking-wide uppercase">Royalty Split Sheet Escrow</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    {Number(props.unmatchedRoyaltiesCount || 0) > 0 ? `${props.unmatchedRoyaltiesCount} Unmatched` : props.hasPendingSplits === true ? 'Pending splits' : 'Not assessed'}
                </span>
            </div>
            <p className="text-xs text-slate-300">
                Review recorded split agreements and unmatched royalty entries before making release decisions.
            </p>
        </div>
    );
}

function CampaignMonitorWidget(props: Record<string, unknown>) {
    return (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white tracking-wide uppercase">Active Campaign Monitor</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    {typeof props.activeAdCampaigns === 'number' && Number.isFinite(props.activeAdCampaigns)
                        ? `${props.activeAdCampaigns} Running` : 'Not loaded'}
                </span>
            </div>
            <p className="text-xs text-slate-400">Campaign count reflects the supplied workspace context; provider delivery and performance are not verified here.</p>
        </div>
    );
}

function ReleaseTimelineWidget(_props: Record<string, unknown>) {
    return (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white tracking-wide uppercase">Release Delivery Timeline</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">Not assessed</span>
            </div>
            <p className="text-xs text-slate-400">Open your release to review its actual delivery and milestone records.</p>
        </div>
    );
}

export const COMPONENT_REGISTRY: Record<DynamicComponentKey, React.ComponentType<Record<string, unknown>>> = {
    StemInspector: StemInspectorWidget,
    RoyaltySplitTable: RoyaltySplitTableWidget,
    CampaignMonitor: CampaignMonitorWidget,
    ReleaseTimeline: ReleaseTimelineWidget,
};

export const ALL_DYNAMIC_MODULE_KEYS: DynamicComponentKey[] = [
    'StemInspector',
    'RoyaltySplitTable',
    'CampaignMonitor',
    'ReleaseTimeline',
];

/**
 * Deterministic local baseline layout resolution:
 * Evaluated instantly without waiting for network or Jev inference.
 */
export function getDeterministicLayout(
    context: LayoutContextData,
    availableKeys: DynamicComponentKey[] = ALL_DYNAMIC_MODULE_KEYS
): { orderedModules: DynamicComponentKey[]; layoutVariant: 'compact' | 'expanded' } {
    const list = [...availableKeys];

    // Priority heuristic: pending legal/financial splits always first
    if (context.hasPendingSplits || context.unmatchedRoyaltiesCount > 0) {
        const idx = list.indexOf('RoyaltySplitTable');
        if (idx > -1) {
            list.splice(idx, 1);
            list.unshift('RoyaltySplitTable');
        }
    } else if (context.activeAdCampaigns > 0) {
        const idx = list.indexOf('CampaignMonitor');
        if (idx > -1) {
            list.splice(idx, 1);
            list.unshift('CampaignMonitor');
        }
    }

    const isExpanded =
        context.hasPendingSplits ||
        context.activeAdCampaigns > 1 ||
        context.activeReleaseType === 'album' ||
        context.activeReleaseType === 'ep';

    return {
        orderedModules: list,
        layoutVariant: isExpanded ? 'expanded' : 'compact',
    };
}

/**
 * Hook to resolve dynamic dashboard layout via fast Jev classification with
 * synchronous local heuristic fallback.
 */
export function useDynamicDashboardLayout(
    context: LayoutContextData,
    availableKeys: DynamicComponentKey[] = ALL_DYNAMIC_MODULE_KEYS
) {
    const baseline = getDeterministicLayout(context, availableKeys);
    const { activeReleaseType, hasPendingSplits, unmatchedRoyaltiesCount, activeAdCampaigns } = context;
    const contextKey = JSON.stringify({
        activeReleaseType,
        hasPendingSplits,
        unmatchedRoyaltiesCount,
        activeAdCampaigns,
        availableKeys,
    });
    const [judgedLayout, setJudgedLayout] = useState<{
        key: string;
        value: ReturnType<typeof getDeterministicLayout>;
    } | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (availableKeys.length === 0) return;

        async function resolveJevLayout() {
            const decision = await judgeDynamicDashboardLayout({
                activeReleaseType,
                hasPendingSplits,
                unmatchedRoyaltiesCount,
                activeAdCampaigns,
            }, availableKeys).catch(() => null);
            if (isMounted && decision) {
                setJudgedLayout({ key: contextKey, value: decision });
            }
        }

        void resolveJevLayout();

        return () => {
            isMounted = false;
        };
    }, [
        activeReleaseType,
        hasPendingSplits,
        unmatchedRoyaltiesCount,
        activeAdCampaigns,
        availableKeys,
        contextKey,
    ]);

    return judgedLayout?.key === contextKey ? judgedLayout.value : baseline;
}

// ---------------------------------------------------------------------------
// Dynamic Module Container
// Hydrates and renders validated React components with error isolation & Suspense
// ---------------------------------------------------------------------------

const NO_DYNAMIC_MODULE_KEYS: DynamicComponentKey[] = [];

export interface DynamicModuleContainerProps {
    moduleKeys?: DynamicComponentKey[];
    contextData?: Record<string, unknown>;
    layoutVariant?: 'compact' | 'expanded';
    artistId?: string;
    layoutContext?: LayoutContextData;
}

export function DynamicModuleContainer({
    moduleKeys: propModuleKeys,
    contextData = {},
    layoutVariant: propLayoutVariant,
    artistId,
    layoutContext,
}: DynamicModuleContainerProps) {
    const fallbackContext: LayoutContextData = layoutContext || {
        hasPendingSplits: false,
        unmatchedRoyaltiesCount: 0,
        activeAdCampaigns: 0,
    };

    const resolved = useDynamicDashboardLayout(fallbackContext, layoutContext ? ALL_DYNAMIC_MODULE_KEYS : NO_DYNAMIC_MODULE_KEYS);
    const keys = propModuleKeys || resolved.orderedModules;
    const variant = propLayoutVariant || resolved.layoutVariant;
    if (keys.length === 0) return null;
    const widgetContext = { ...layoutContext, ...contextData };

    return (
        <div
            className={`w-full ${
                variant === 'expanded'
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                    : 'flex flex-col gap-3'
            }`}
            data-testid="dynamic-module-container"
        >
            {keys.map((key) => {
                const Component = COMPONENT_REGISTRY[key];
                if (!Component) return null;

                return (
                    <Suspense
                        key={key}
                        fallback={
                            <div
                                className="h-28 animate-pulse bg-white/5 rounded-xl border border-white/5"
                                data-testid={`skeleton-${key}`}
                            />
                        }
                    >
                        <Component {...widgetContext} artistId={artistId} />
                    </Suspense>
                );
            })}
        </div>
    );
}
