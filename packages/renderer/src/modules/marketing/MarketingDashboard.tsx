import React, { useState, Suspense, lazy } from 'react';
import { Megaphone, Briefcase, Mic, Share2, Users, BarChart } from 'lucide-react';
import CampaignDashboard from './components/CampaignDashboard';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';

// ISSUE-1442 Stage 2: the marketing domain folds into one destination.
// Brand, Publicist, Social, CRM, and Analytics keep their module ids (deep
// links still land on working surfaces) but are no longer separate nav
// destinations — they mount here as specialist tabs of the department.
const BrandManagerLazy = lazy(() => import('./components/BrandManager'));
const PublicistDashboardLazy = lazy(() => import('../publicist/PublicistDashboard'));
const SocialDashboardLazy = lazy(() => import('../social/SocialDashboard'));
const CRMDashboardLazy = lazy(() => import('../crm/CRMDashboard'));
const GrowthIntelligenceLazy = lazy(() => import('../analytics/GrowthIntelligenceDashboard'));

type MarketingTab = 'departments' | 'brand' | 'publicist' | 'social' | 'crm' | 'analytics';

function readInitialTab(): MarketingTab {
    try {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (['brand', 'publicist', 'social', 'crm', 'analytics'].includes(tab ?? '')) {
            return tab as MarketingTab;
        }
    } catch {
        // Non-browser environment — default below.
    }
    return 'departments';
}

const TABS: { id: MarketingTab; label: string; icon: typeof Megaphone }[] = [
    { id: 'departments', label: 'Departments', icon: Megaphone },
    { id: 'brand', label: 'Brand', icon: Briefcase },
    { id: 'publicist', label: 'Publicist', icon: Mic },
    { id: 'social', label: 'Social', icon: Share2 },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart },
];

/**
 * Main Marketing Module Entry Point
 *
 * One Marketing Department destination: the campaign workspace by default,
 * with the domain specialists (Brand, Publicist, Social, CRM, Analytics) as
 * tabs of the same department.
 */
export default function MarketingDashboard() {
    const [activeTab, setActiveTab] = useState<MarketingTab>(readInitialTab);

    const selectTab = (tab: MarketingTab) => {
        setActiveTab(tab);
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', tab);
            window.history.replaceState(null, '', url.toString());
        } catch {
            // URL best-effort only — the tab still switches.
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Specialist tab strip — one department, no separate destinations */}
            <div className="flex items-center gap-2 px-4 pt-3 flex-shrink-0 bg-background/60 backdrop-blur-sm border-b border-white/5" role="tablist" aria-label="Marketing department sections">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        data-testid={`marketing-tab-${tab.id}`}
                        onClick={() => selectTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id
                            ? 'bg-dept-marketing/15 border border-dept-marketing/40 text-dept-marketing'
                            : 'bg-white/[0.02] border border-white/5 text-gray-400 hover:text-white hover:border-white/15'
                            }`}
                    >
                        <tab.icon size={12} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0" data-testid={`marketing-pane-${activeTab}`}>
                {activeTab === 'departments' ? (
                    <ModuleErrorBoundary moduleName="Marketing">
                        <CampaignDashboard />
                    </ModuleErrorBoundary>
                ) : (
                    <Suspense fallback={<LoadingFallback />}>
                        <ModuleErrorBoundary moduleName={`Marketing / ${activeTab}`}>
                            {activeTab === 'brand' && <BrandManagerLazy />}
                            {activeTab === 'publicist' && <PublicistDashboardLazy />}
                            {activeTab === 'social' && <SocialDashboardLazy />}
                            {activeTab === 'crm' && <CRMDashboardLazy />}
                            {activeTab === 'analytics' && <GrowthIntelligenceLazy />}
                        </ModuleErrorBoundary>
                    </Suspense>
                )}
            </div>
        </div>
    );
}
