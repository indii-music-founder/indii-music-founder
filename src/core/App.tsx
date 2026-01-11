import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { VoiceProvider } from './context/VoiceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/MobileNav';
import LoginForm from './components/auth/LoginForm';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';
import { ApprovalModal } from './components/ApprovalModal';
import { ApprovalManager } from '@/components/instruments/InstrumentApprovalModal';
import ChatOverlay from './components/ChatOverlay';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { env } from '@/config/env';
import { useNavigate, useLocation } from 'react-router-dom';

// ============================================================================
// Lazy-loaded Module Components
// ============================================================================

const CreativeStudio = lazy(() => import('../modules/creative/CreativeStudio'));
const MusicStudio = lazy(() => import('../modules/music/MusicStudio'));
const LegalDashboard = lazy(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = lazy(() => import('../modules/marketing/MarketingDashboard'));
const VideoStudio = lazy(() => import('../modules/video/VideoStudioContainer'));
const WorkflowLab = lazy(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const KnowledgeBase = lazy(() => import('../modules/knowledge/KnowledgeBase'));
const RoadManager = lazy(() => import('../modules/touring/RoadManager'));
const SocialDashboard = lazy(() => import('../modules/social/SocialDashboard'));
const BrandManager = lazy(() => import('../modules/marketing/components/BrandManager'));
const CampaignDashboard = lazy(() => import('../modules/marketing/components/CampaignDashboard'));
const PublicistDashboard = lazy(() => import('../modules/publicist/PublicistDashboard'));
const PublishingDashboard = lazy(() => import('../modules/publishing/PublishingDashboard'));
const FinanceDashboard = lazy(() => import('../modules/finance/FinanceDashboard'));
const LicensingDashboard = lazy(() => import('../modules/licensing/LicensingDashboard'));
const OnboardingPage = lazy(() => import('../modules/onboarding/pages/OnboardingPage'));
// Showroom integrated into Merchandise
const AgentDashboard = lazy(() => import('../modules/agent/components/AgentDashboard'));
const DistributionDashboard = lazy(() => import('../modules/distribution/DistributionDashboard'));

const FilePreview = lazy(() => import('../modules/files/FilePreview'));
const MerchStudio = lazy(() => import('../modules/merchandise/MerchStudio'));
const AudioAnalyzer = lazy(() => import('../modules/tools/AudioAnalyzer'));
const BananaThemePreview = lazy(() => import('../components/BananaThemePreview').then(m => ({ default: m.BananaThemePreview })));
const ObservabilityDashboard = lazy(() => import('../modules/observability/ObservabilityDashboard'));
const ReferenceManager = lazy(() => import('../modules/tools/ReferenceManager'));

// Dev-only components
const TestPlaybookPanel = lazy(() => import('./dev/TestPlaybookPanel'));
const AudioStressTest = lazy(() => import('../dev/AudioStressTest'));

// ============================================================================
// Module Router - Maps module IDs to components
// ============================================================================

// Use flexible type to accommodate different component prop signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODULE_COMPONENTS: Partial<Record<ModuleId, React.LazyExoticComponent<React.ComponentType<any>>>> = {
    'dashboard': Dashboard,
    'creative': CreativeStudio,
    'video': VideoStudio,
    'music': MusicStudio,
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
    // 'showroom': Showroom, // Removed
    'onboarding': OnboardingPage,
    'agent': AgentDashboard,
    'files': FilePreview,
    'distribution': DistributionDashboard,
    'merch': MerchStudio,
    'audio-analyzer': AudioAnalyzer,
    'banana-preview': BananaThemePreview,
    'observability': ObservabilityDashboard,
    'reference-manager': ReferenceManager,
};

// ============================================================================
// Helper Components
// ============================================================================

function LoadingFallback() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Delay showing the loader to prevent flash for fast module loads
        const timer = setTimeout(() => setShow(true), 200);
        return () => clearTimeout(timer);
    }, []);

    // Don't show anything for the first 200ms (prevents flash)
    if (!show) {
        return null;
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 px-6 py-4 bg-surface/90 rounded-lg border border-white/10 shadow-lg">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
        </div>
    );
}

function DevPortWarning() {
    const port = window.location.port;
    if (!import.meta.env.DEV || port === '4242') return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-bold border border-red-400 animate-pulse">
            Wrong Port: {port}
            <br />
            <span className="font-normal opacity-80">Use :4242 for Studio</span>
        </div>
    );
}

// ============================================================================
// Custom Hooks
// ============================================================================

function useAppInitialization() {
    const { initializeAuthListener, loadUserProfile, user, initializeHistory, loadProjects } = useStore();

    // 1. Initialize Auth Listener (Firebase)
    useEffect(() => {
        // Log removed (Platinum Polish)
        const unsubscribe = initializeAuthListener();
        return () => unsubscribe();
    }, [initializeAuthListener]);

    // 2. Load User Profile when User is Authenticated
    useEffect(() => {
        if (user?.uid) {
            loadUserProfile(user.uid);
        }
    }, [user, loadUserProfile]);

    // 3. Load Application Data (Projects, History) when Profile is ready
    // We assume if user exists and profile is loaded (we don't have isProfileReady yet, but let's assume loose coupling)
    useEffect(() => {
        if (user) {
            // Log removed (Platinum Polish)
            initializeHistory();
            loadProjects();

            // Re-enable Agent if needed, but keep closed by default
            useStore.setState({ isAgentOpen: false });
        }
    }, [user, initializeHistory, loadProjects]);
}

function useOnboardingRedirect() {
    const { user, authLoading, currentModule } = useStore();

    useEffect(() => {
        if (authLoading) return;

        // If not authenticated, we might want to redirect to a login screen?
        // But currently App.tsx doesn't have a specific login route visible in the code I saw.
        // It renders modules. We probably need a Login Module or Overlay.

    }, [user, authLoading, currentModule]);
}

function useURLSync() {
    const { currentModule, setModule } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    // 1. URL -> Store (Deep Link / Back Button)
    useEffect(() => {
        // Parse module from path segments (robust splitting)
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const targetModule = pathSegments[0] || 'dashboard';

        // Check if it is a valid module
        // We cast to ModuleId to check existence in MODULE_COMPONENTS
        if (targetModule !== currentModule && MODULE_COMPONENTS[targetModule as ModuleId]) {
             setModule(targetModule as ModuleId);
        }
    }, [location.pathname, currentModule, setModule]);

    // 2. Store -> URL (Navigation)
    useEffect(() => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        const currentPathModule = pathSegments[0] || 'dashboard';

        // Only navigate if the module actually CHANGED from what's in the URL
        // This preserves sub-paths (e.g. /creative/123) if the module is still 'creative'
        if (currentModule !== currentPathModule) {
             const targetUrl = currentModule === 'dashboard' ? '/' : `/${currentModule}`;
             navigate(targetUrl);
        }
    }, [currentModule, navigate, location.pathname]);
}

// ============================================================================
// Module Renderer Component
// ============================================================================

interface ModuleRendererProps {
    moduleId: ModuleId;
}

function ModuleRenderer({ moduleId }: ModuleRendererProps) {
    const ModuleComponent = MODULE_COMPONENTS[moduleId];

    if (!ModuleComponent) {
        return <div className="flex items-center justify-center h-full text-gray-500">Unknown module</div>;
    }

    // Special case for creative studio which needs initialMode prop
    if (moduleId === 'creative') {
        return <ModuleComponent initialMode="image" />;
    }

    return <ModuleComponent />;
}

// ============================================================================
// Main App Component
// ============================================================================

export default function App() {
    const { currentModule, user, authLoading, loginWithGoogle } = useStore();

    // Initialize app and handle onboarding
    useAppInitialization();
    useOnboardingRedirect();

    // Log module changes in dev

    // Handle Theme Switching
    const { userProfile } = useStore();
    useEffect(() => {
        const theme = userProfile?.preferences?.theme || 'dark';

        // Remove all theme classes first
        document.documentElement.classList.remove('dark', 'banana', 'banana-pro');

        // Apply current theme
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (theme === 'banana') {
            document.documentElement.classList.add('banana');
        } else if (theme === 'banana-pro') {
            document.documentElement.classList.add('banana-pro', 'dark'); // Banana Pro is dark-based
        }
    }, [userProfile?.preferences?.theme]);

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // Call URL Sync Hook (must be inside Router context, which App is)
    useURLSync();

    if (authLoading) {
        return <LoadingFallback />;
    }

    if (!user) {
        return <LoginForm />;
    }

    return (
        <VoiceProvider>
            <ToastProvider>
                <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden" data-testid="app-container">
                    {/* Left Sidebar - Hidden for standalone modules */}
                    {showChrome && (
                        <div className="hidden md:block h-full">
                            <ErrorBoundary>
                                <Sidebar />
                            </ErrorBoundary>
                        </div>
                    )}

                    <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                            <ErrorBoundary>
                                <Suspense fallback={<LoadingFallback />}>
                                    <ModuleRenderer moduleId={currentModule as ModuleId} />
                                </Suspense>
                            </ErrorBoundary>
                        </div>

                        {showChrome && (
                            <div className="flex-shrink-0 z-10 relative">
                                <ErrorBoundary>
                                    <ChatOverlay />
                                    <CommandBar />
                                </ErrorBoundary>
                            </div>
                        )}
                    </main>

                    {/* Right Panel - Hidden for standalone modules and mobile */}
                    {showChrome && typeof window !== 'undefined' && window.innerWidth >= 768 && (
                        <ErrorBoundary>
                            <RightPanel />
                        </ErrorBoundary>
                    )}

                    {/* Mobile Navigation - Hidden for standalone modules */}
                    {showChrome && (
                        <ErrorBoundary>
                            <MobileNav />
                        </ErrorBoundary>
                    )}

                    {/* DevTools HUD - Only in Development */}
                    {import.meta.env.DEV && (
                        <Suspense fallback={null}>
                            <TestPlaybookPanel />
                            <div className="fixed bottom-4 left-4 z-50">
                                <AudioStressTest />
                            </div>
                            <DevPortWarning />
                        </Suspense>
                    )}

                    {/* Agent Approval Modal - Shows when agent requests user approval */}
                    <ApprovalModal />

                    {/* Instrument Approval Manager - Shows for instrument execution approvals */}
                    <ApprovalManager />

                    {/* PWA Install Prompt - Shows when app can be installed */}
                    <PWAInstallPrompt />
                </div>
            </ToastProvider>
        </VoiceProvider>
    );
}
