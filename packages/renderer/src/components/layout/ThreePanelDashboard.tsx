import React from 'react';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

export interface ThreePanelDashboardProps {
    /** The name of the module for the error boundary (e.g. "Finance") */
    moduleName: string;

    /** The icon element for the header (e.g. <TrendingUp size={18} className="text-white" />) */
    headerIcon: React.ReactNode;

    /** Display title for the dashboard header */
    title: string;

    /** Subtitle for the dashboard header */
    subtitle: string;

    /** Full tailwind class for the background blur (e.g. "bg-blue-500/8") */
    bgBlobClass: string;

    /** Full tailwind class for the icon background (e.g. "bg-gradient-to-br from-blue-500 to-blue-400") */
    iconBgClass: string;

    /** Full tailwind class for the icon shadow (e.g. "shadow-blue-500/20") */
    iconShadowClass: string;

    /** Left sidebar content */
    leftPanel: React.ReactNode;

    /** Right sidebar content */
    rightPanel?: React.ReactNode;

    /** Center content (placed directly under the header in the flex-1 container) */
    children: React.ReactNode;
}

/**
 * ThreePanelDashboard
 * 
 * Abstracted unified layout skeleton for Three-Panel modules (Legal, Finance, Licensing).
 * Enforces rigid structural consistency across modules while accepting highly cohesive
 * customized theming via tailwind class injections to prevent JIT pruning.
 */
export function ThreePanelDashboard({
    moduleName,
    headerIcon,
    title,
    subtitle,
    bgBlobClass,
    iconBgClass,
    iconShadowClass,
    leftPanel,
    rightPanel,
    children
}: ThreePanelDashboardProps) {
    return (
        <ModuleErrorBoundary moduleName={moduleName}>
            <div className="absolute inset-0 flex bg-bg-dark text-white overflow-hidden">
                {/* ── LEFT PANEL ──────────── */}
                <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    {leftPanel}
                </aside>

                {/* ── CENTER ──────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                        <div className={`absolute top-[-80px] left-[-80px] w-[300px] h-[300px] blur-[100px] pointer-events-none rounded-full ${bgBlobClass}`} />
                        <div className="relative z-10 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg ${iconBgClass} ${iconShadowClass}`}>
                                {headerIcon}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">{title}</h1>
                                <p className="text-muted-foreground font-medium tracking-wide text-[10px]">{subtitle}</p>
                            </div>
                        </div>
                    </div>

                    {/* Content (Tabs / Main feed) */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {children}
                    </div>
                </div>

                {/* ── RIGHT PANEL ────────────── */}
                {rightPanel && (
                    <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                        {rightPanel}
                    </aside>
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
