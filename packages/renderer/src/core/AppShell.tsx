import { lazy, Suspense, useEffect, useMemo } from 'react';
import { MotionConfig } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import { ToastProvider } from './context/ToastContext';
import { VoiceProvider } from './context/VoiceContext';
import { ThemeProvider } from './context/ThemeContext';

import { ErrorBoundary } from './components/ErrorBoundary';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { ModuleAmbientBackground } from './components/ModuleAmbientBackground';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileHeader } from './components/MobileHeader';

import { ApprovalModal } from './components/ApprovalModal';
import CostWarningModal from './components/CostWarningModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { WalletConnectDialog } from '@/components/ui/WalletConnectDialog';
import { BiometricGate } from './components/auth/BiometricGate';
import { ResponsiveLayoutProvider } from '@/providers/ResponsiveLayoutProvider';
import { ShareTargetHandler } from '@/core/components/ShareTargetHandler';
import { ApprovalManager } from '@/components/instruments/InstrumentApprovalModal';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { getGatedModuleIds } from '@/config/featureFlags';
import { GatedModuleFallback } from '@/core/components/GatedModuleFallback';
import { env } from '@/config/env';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMobile } from '@/hooks/useMobile';
import { GlobalKeyboardShortcuts, useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { UnifiedCommandMenu } from '@/components/shared/UnifiedCommandMenu';
import { GlobalDropZone } from '@/components/shared/GlobalDropZone';
import { UploadQueueMonitor } from '@/components/shared/UploadQueueMonitor';
import { BackgroundJobMonitor } from '@/components/shared/BackgroundJobMonitor';
import AudioPIPPlayer from '@/components/shared/AudioPIPPlayer';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';

import type { Subscription } from '@/services/subscription/types';
import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';
import { useSubscription } from '@/modules/finance/hooks/useSubscription';
import { UpdaterMonitor } from './components/UpdaterMonitor';
import { CookieConsentBanner } from '@/components/shared/CookieConsentBanner';
import { FirstRunTour } from '@/components/shared/FirstRunTour';
import { BusinessActivityTracker } from '@/services/business-harness/BusinessActivityTracker';
import { AgentFeedbackWidget } from '@/components/ui/AgentFeedbackWidget';
import { TaskPlanWidget } from './components/TaskPlanWidget';
import { AgentCanvasPanel } from './components/AgentCanvasPanel';
import ChatOverlay from './components/ChatOverlay';
import { importWithRetry } from '@/utils/dynamicImport';
import { setSentryUser, clearSentryUser } from '@/services/observability/SentryService';

// ============================================================================
// Lazy-loaded Module Components
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyWithRetry = (componentImport: () => Promise<any>) => {
    return lazy(() => importWithRetry(componentImport));
};

const CreativeStudio = lazyWithRetry(() => import('../modules/creative/CreativeStudio'));
const LegalDashboard = lazyWithRetry(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = lazyWithRetry(() => import('../modules/marketing/MarketingDashboard'));
const WorkflowLab = lazyWithRetry(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = lazyWithRetry(() => import('../modules/dashboard/Dashboard'));
const KnowledgeBase = lazyWithRetry(() => import('../modules/knowledge/KnowledgeBase'));
const RoadManager = lazyWithRetry(() => import('../modules/touring/RoadManager'));
const SocialDashboard = lazyWithRetry(() => import('../modules/social/SocialDashboard'));
const BrandManager = lazyWithRetry(() => import('../modules/marketing/components/BrandManager'));
const CampaignDashboard = lazyWithRetry(() => import('../modules/marketing/components/CampaignDashboard'));
const PublicistDashboard = lazyWithRetry(() => import('../modules/publicist/PublicistDashboard'));
const PublishingDashboard = lazyWithRetry(() => import('../modules/publishing/PublishingDashboard'));
const FinanceDashboard = lazyWithRetry(() => import('../modules/finance/FinanceDashboard'));
const LicensingDashboard = lazyWithRetry(() => import('../modules/licensing/LicensingDashboard'));
const OnboardingPage = lazyWithRetry(() => import('../modules/onboarding/pages/OnboardingPage'));
const AgentDashboard = lazyWithRetry(() => import('../modules/agent/components/AgentDashboard'));
const DistributionDashboard = lazyWithRetry(() => import('../modules/distribution/DistributionDashboard'));

const FileDashboard = lazyWithRetry(() => import('../modules/files/FileDashboard'));
const MerchStudio = lazyWithRetry(() => import('../modules/merchandise/MerchStudio'));
const AudioAnalyzer = lazyWithRetry(() => import('../modules/tools/AudioAnalyzer'));
const ObserverabilityDashboard = lazyWithRetry(() => import('../modules/observability/ObservabilityDashboard'));
const HistoryDashboard = lazyWithRetry(() => import('../modules/history/HistoryDashboard'));
const NotesModule = lazyWithRetry(() => import('../modules/notes/NotesModule'));
const MultimodalGauntlet = lazyWithRetry(() => import('../modules/debug/MultimodalGauntlet'));
const InvestorPortal = lazyWithRetry(() => import('../modules/investor/InvestorPortal'));
const GhostCapture = lazyWithRetry(() => import('../modules/capture/GhostCapture'));
const MemoryDashboard = lazyWithRetry(() => import('../modules/memory/MemoryDashboard'));
const MarketplaceModule = lazyWithRetry(() => import('../modules/marketplace'));
const SelectOrg = lazyWithRetry(() => import('../modules/select-org/SelectOrg'));
const SettingsPanel = lazyWithRetry(() => import('../modules/settings/SettingsPanel'));
const MobileRemote = lazyWithRetry(() => import('../modules/mobile-remote/MobileRemote'));
const GrowthIntelligenceDashboard = lazyWithRetry(() => import('../modules/analytics/GrowthIntelligenceDashboard'));
const DesktopDashboard = lazyWithRetry(() => import('../modules/desktop/DesktopDashboard'));
const FoundersCheckout = lazyWithRetry(() => import('../modules/founders/FoundersCheckout'));
const FoundersPortal = lazyWithRetry(() => import('../modules/founders/FoundersPortal'));
const FoundersRecognition = lazyWithRetry(() => import('../modules/founders/FoundersRecognition'));
const VideoPopout = lazyWithRetry(() => import('../modules/creative/video/editor/VideoPopout'));
const RegistrationCenter = lazyWithRetry(() => import('../modules/registration/RegistrationCenter'));
const SecurityDashboard = lazyWithRetry(() => import('../modules/security/SecurityDashboard'));
const DevopsDashboard = lazyWithRetry(() => import('../modules/devops/DevopsDashboard'));
const ScreenwriterDashboard = lazyWithRetry(() => import('../modules/screenwriter/ScreenwriterDashboard'));
const CRMDashboard = lazyWithRetry(() => import('../modules/crm/CRMDashboard'));

// Lazy-load AudioVisualizer to defer Three.js initialization until component is rendered
const AudioVisualizer = lazyWithRetry(() => import('@/components/shared/AudioVisualizer').then(m => ({ default: m.AudioVisualizer })));

const BoardroomModule = lazyWithRetry(() => import('../modules/boardroom/BoardroomModule').then(m => ({ default: m.BoardroomModule })));
const TransmissionMonitor = lazyWithRetry(() => import('../modules/distribution/components/TransmissionMonitor').then(m => ({ default: m.TransmissionMonitor })));

// ============================================================================
// Module Router - Maps module IDs to components
// ============================================================================

interface ModuleProps {
    initialMode?: 'image' | 'video';
    [key: string]: unknown;
}

const MODULE_COMPONENTS: Partial<Record<ModuleId, React.LazyExoticComponent<React.ComponentType<ModuleProps>>>> = {
    'dashboard': Dashboard,
    'creative': CreativeStudio,
    'legal': LegalDashboard,
    'marketing': MarketingDashboard,
    'workflow': WorkflowLab,
    'knowledge': KnowledgeBase,
    'road': RoadManager,
    'social': SocialDashboard,
    'brand': BrandManager,
    'campaign': CampaignDashboard,
    'publicist': PublicistDashboard,
    'publishing': PublishingDashboard,
    'finance': FinanceDashboard,
    'licensing': LicensingDashboard,
    'onboarding': OnboardingPage,
    'agent': AgentDashboard,
    'files': FileDashboard,
    'distribution': DistributionDashboard,
    'merch': MerchStudio,
    'marketplace': MarketplaceModule,
    'audio-analyzer': AudioAnalyzer,
    'observability': ObserverabilityDashboard,
    'select-org': SelectOrg,
    'history': HistoryDashboard,
    'notes': NotesModule,
    'debug': MultimodalGauntlet,
    'investor': InvestorPortal,
    'capture': GhostCapture,
    'memory': MemoryDashboard,
    'settings': SettingsPanel,
    'mobile-remote': MobileRemote,
    'analytics': GrowthIntelligenceDashboard,
    'desktop': DesktopDashboard,
    'founders-checkout': FoundersCheckout,
    'founders-portal': FoundersPortal,
    'founders-recognition': FoundersRecognition,
    'video-popout': VideoPopout,
    'registration': RegistrationCenter,
    'security': SecurityDashboard,
    'devops': DevopsDashboard,
    'screenwriter': ScreenwriterDashboard,
    'crm': CRMDashboard,
};

// Modules that require a verified (non-anonymous) account
const COMMERCIAL_MODULES = new Set<ModuleId>([
    'distribution', 'licensing', 'merch', 'publishing',
]);

function useOnboardingRedirect() {
    const { user, authLoading, currentModule, setModule, userProfile } = useStore(
        useShallow(s => ({
            user: s.user,
            authLoading: s.authLoading,
            currentModule: s.currentModule,
            setModule: s.setModule,
            userProfile: s.userProfile,
        }))
    );

    useEffect(() => {
        if (user) {
            setSentryUser(user.uid, user.email ?? undefined);
        } else if (!authLoading) {
            clearSentryUser();
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (authLoading || !user) return;

        if (currentModule === 'onboarding') return;

        if (STANDALONE_MODULES.includes(currentModule as ModuleId)) return;

        if (env.skipOnboarding) return;

        if (user.isAnonymous && COMMERCIAL_MODULES.has(currentModule as ModuleId)) {
            return;
        }

        if (user.isAnonymous) return;

        const profileStillPending = userProfile?.id === 'pending';
        const hasExplicitlySkipped = typeof window !== 'undefined' && localStorage.getItem('onboarding_dismissed') === 'true';
        const hasFounderPreviewPending = typeof window !== 'undefined' && localStorage.getItem('indii_founder_preview_pending') === 'true';

        if ((profileStillPending || hasFounderPreviewPending) && !hasExplicitlySkipped) {
            if (hasFounderPreviewPending) {
                try {
                    localStorage.setItem('indii_founder_funnel_active', 'true');
                    localStorage.removeItem('indii_founder_preview_pending');
                } catch {
                    // ignore
                }
            }
            setModule('onboarding');
        }
    }, [user, authLoading, currentModule, setModule, userProfile]);
}

function GuestGate({ onUpgrade }: { onUpgrade: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-gray-400 px-6 text-center">
            <div className="text-5xl">🔒</div>
            <div className="text-xl font-semibold text-gray-200">Account required</div>
            <p className="text-sm text-gray-500 max-w-xs">
                This feature requires a free account. Sign up in seconds to unlock distribution, finance, licensing, and more.
            </p>
            <button
                onClick={onUpgrade}
                className="px-6 py-2.5 bg-dept-creative hover:bg-dept-creative-glow text-white rounded-lg text-sm font-semibold transition-colors"
            >
                Create Free Account
            </button>
        </div>
    );
}

function UpgradeGate({ onUpgrade }: { onUpgrade: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-gray-400 px-6 text-center">
            <div className="text-5xl">⭐</div>
            <div className="text-xl font-semibold text-gray-200">Premium feature</div>
            <p className="text-sm text-gray-500 max-w-xs">
                This feature requires a subscription. Upgrade to Pro or Studio to unlock distribution, finance, licensing, and more.
            </p>
            <button
                onClick={onUpgrade}
                className="px-6 py-2.5 bg-dept-creative hover:bg-dept-creative-glow text-white rounded-lg text-sm font-semibold transition-colors"
            >
                Upgrade Now
            </button>
        </div>
    );
}

interface ModuleRendererProps {
    moduleId: ModuleId;
}

function ModuleRenderer({ 
    moduleId, 
    subscription, 
    subLoading 
}: ModuleRendererProps & { 
    subscription: Subscription | null; 
    subLoading: boolean 
}) {
    const location = useLocation();
    const subPath = useMemo(() => {
        const segments = location.pathname.split('/').filter(Boolean);
        return segments.length > 1 ? segments[1] : undefined;
    }, [location.pathname]);

    const { user, setModule } = useStore(
        useShallow(s => ({ user: s.user, setModule: s.setModule }))
    );

    const ModuleComponent = MODULE_COMPONENTS[moduleId];

    if (!ModuleComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="text-6xl">404</div>
                <div className="text-xl font-semibold text-gray-300">Module not found</div>
                <div className="text-sm text-gray-500">The page <code className="text-dept-creative">/{moduleId}</code> doesn't exist.</div>
            </div>
        );
    }

    const gatedModules = getGatedModuleIds();
    if (gatedModules.has(moduleId)) {
        return <GatedModuleFallback moduleName={moduleId} />;
    }

    if (subPath && /^\d+$/.test(subPath)) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="text-6xl">404</div>
                <div className="text-xl font-semibold text-gray-300">Not found</div>
                <div className="text-sm text-gray-500">
                    <code className="text-dept-creative">/{moduleId}/{subPath}</code> doesn't exist.
                </div>
            </div>
        );
    }

    if (user?.isAnonymous && COMMERCIAL_MODULES.has(moduleId) && !env.skipOnboarding) {
        return <GuestGate onUpgrade={() => setModule('onboarding')} />;
    }

    if (!user?.isAnonymous && !subLoading && COMMERCIAL_MODULES.has(moduleId) && !env.skipOnboarding) {
        if (subscription?.tier === SubscriptionTier.FREE) {
            return <UpgradeGate onUpgrade={() => setModule('finance')} />;
        }
    }

    if (moduleId === 'creative') {
        return <ModuleComponent initialMode="image" />;
    }

    return <ModuleComponent />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AppContent({ currentModule, showChrome, isDesktop, isAnyPhone, shortcutsModal }: any) {
    useOnboardingRedirect();

    const { subscription, loading: subLoading } = useSubscription();

    const { isAgentOpen, toggleAgentWindow } = useStore(
        useShallow(s => ({
            isAgentOpen: s.isAgentOpen,
            toggleAgentWindow: s.toggleAgentWindow,
        }))
    );
    const userId = useStore(s => s.user?.uid);

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden" data-testid="app-container">
            <BusinessActivityTracker userId={userId} currentModule={currentModule} />
            <GlobalDropZone>
                <ShareTargetHandler />
                <BiometricGate>
                    <div className="flex w-full h-full">
                        {showChrome && (
                            <div className="hidden md:block h-full">
                                <ErrorBoundary>
                                    <Sidebar />
                                </ErrorBoundary>
                            </div>
                        )}

                        <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-background relative z-0">
                            <ModuleAmbientBackground />

                            <Suspense fallback={null}>
                                <AudioVisualizer />
                            </Suspense>

                            {showChrome && (
                                <MobileHeader />
                            )}

                            <div className={`flex-1 overflow-y-auto relative z-10 custom-scrollbar ${isAnyPhone ? 'pb-[88px]' : ''}`}>
                                <ModuleErrorBoundary key={currentModule} moduleName={currentModule}>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <ModuleRenderer 
                                            moduleId={currentModule as ModuleId} 
                                            subscription={subscription} 
                                            subLoading={subLoading} 
                                        />
                                    </Suspense>
                                </ModuleErrorBoundary>
                            </div>
                        </main>

                        {showChrome && isDesktop && (
                            <ErrorBoundary>
                                <RightPanel />
                            </ErrorBoundary>
                        )}
                    </div>
                </BiometricGate>

                {showChrome && (
                    <ErrorBoundary>
                        <MobileTabBar />
                    </ErrorBoundary>
                )}

                <ApprovalModal />
                <CostWarningModal />
                <ApprovalManager />
                <PWAInstallPrompt />
                <Suspense fallback={null}>
                    <TransmissionMonitor />
                </Suspense>
                <UpdaterMonitor />

                <UnifiedCommandMenu />

                <Suspense fallback={null}>
                    <BoardroomModule />
                </Suspense>

                <UploadQueueMonitor />
                <BackgroundJobMonitor />
                <AudioPIPPlayer />

                <GlobalKeyboardShortcuts isOpen={shortcutsModal.isOpen} onClose={shortcutsModal.close} />

                <CookieConsentBanner />

                <FirstRunTour />

                <AgentFeedbackWidget />

                <TaskPlanWidget />

                <AgentCanvasPanel />

                {isAgentOpen && (
                    <ErrorBoundary>
                        <ChatOverlay onClose={toggleAgentWindow} />
                    </ErrorBoundary>
                )}

                <ConfirmDialog />
                <AlertDialog />
                <PromptDialog />
                <WalletConnectDialog />
            </GlobalDropZone>
        </div>
    );
}

interface AppShellProps {
    activeModule: string;
    activeShowChrome: boolean;
    isDesktop: boolean;
    isAnyPhone: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shortcutsModal: any;
}

export default function AppShell({ activeModule, activeShowChrome, isDesktop, isAnyPhone, shortcutsModal }: AppShellProps) {
    return (
        <MotionConfig reducedMotion="user">
            <ResponsiveLayoutProvider>
                <VoiceProvider>
                    <ThemeProvider>
                        <ToastProvider>
                            <AppContent 
                                currentModule={activeModule} 
                                showChrome={activeShowChrome} 
                                isDesktop={isDesktop} 
                                isAnyPhone={isAnyPhone} 
                                shortcutsModal={shortcutsModal} 
                            />
                        </ToastProvider>
                    </ThemeProvider>
                </VoiceProvider>
            </ResponsiveLayoutProvider>
        </MotionConfig>
    );
}
