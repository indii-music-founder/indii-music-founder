import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';

// Lazy load modules
const CreativeStudio = lazy(() => import('../modules/creative/CreativeStudio'));
const MusicStudio = lazy(() => import('../modules/music/MusicStudio'));
const LegalDashboard = lazy(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = lazy(() => import('../modules/marketing/MarketingDashboard'));
const VideoStudio = lazy(() => import('../modules/video/VideoStudio'));
const WorkflowLab = lazy(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const SelectOrg = lazy(() => import('../modules/auth/SelectOrg'));
const KnowledgeBase = lazy(() => import('../modules/knowledge/KnowledgeBase'));
const RoadManager = lazy(() => import('../modules/touring/RoadManager'));
const SocialDashboard = lazy(() => import('../modules/social/SocialDashboard'));
const BrandManager = lazy(() => import('../modules/marketing/components/BrandManager'));
const CampaignDashboard = lazy(() => import('../modules/marketing/components/CampaignDashboard'));
const CampaignManager = lazy(() => import('../modules/marketing/components/CampaignManager'));
const PublicistDashboard = lazy(() => import('../modules/publicist/PublicistDashboard'));
const PublishingDashboard = lazy(() => import('../modules/publishing/PublishingDashboard'));
const FinanceDashboard = lazy(() => import('../modules/finance/FinanceDashboard'));
const LicensingDashboard = lazy(() => import('../modules/licensing/LicensingDashboard'));

import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { MobileNav } from './components/MobileNav';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';

import ChatOverlay from './components/ChatOverlay';
import TestPlaybookPanel from './dev/TestPlaybookPanel';

export default function App() {
    const { currentModule, initializeHistory, initializeAuth, loadProjects, isAuthReady, isAuthenticated } = useStore();

    useEffect(() => {
        initializeAuth();
        initializeHistory();
        loadProjects();
        useStore.setState({ isAgentOpen: false });

        // Handle direct navigation to /select-org
        if (window.location.pathname === '/select-org') {
            useStore.setState({ currentModule: 'select-org' });
        }
    }, [initializeAuth, initializeHistory, loadProjects]); // Added dependencies for correctness

    // Auth Guard - Redirect unauthenticated users to login
    useEffect(() => {
        if (isAuthReady && !isAuthenticated) {
            const landingPageUrl = import.meta.env.VITE_LANDING_PAGE_URL || 'https://indiios-v-1-1.web.app/login';

            // In Electron: Open login in SYSTEM BROWSER (not inside Electron)
            // This is required because Google OAuth popups don't work inside Electron due to COOP
            if (window.electronAPI) {
                console.log("[App] Electron detected - opening login in system browser");
                window.electronAPI.openExternal(landingPageUrl);

                // Set up listener for auth token from deep link callback
                window.electronAPI.onAuthToken(async (tokenData) => {
                    try {
                        console.log("[App] Received auth token from deep link");
                        const { getAuth, GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                        const { auth } = await import('@/services/firebase');
                        const credential = GoogleAuthProvider.credential(
                            tokenData.idToken,
                            tokenData.accessToken || null
                        );
                        await signInWithCredential(auth, credential);
                        // Auth state will update and trigger re-render
                    } catch (e) {
                        console.error("[App] Bridge auth failed:", e);
                    }
                });
            } else {
                // In browser: Normal redirect
                console.log("[App] Browser detected - redirecting to:", landingPageUrl);
                window.location.href = landingPageUrl;
            }
        }
    }, [isAuthReady, isAuthenticated]);

    useEffect(() => {
        console.log(`[App] Current Module Changed: ${currentModule}`);
    }, [currentModule]);

    return (
        <ToastProvider>
            <div className="flex h-screen w-screen bg-[#0d1117] text-white overflow-hidden font-sans">
                <ApiKeyErrorModal />
                {/* Left Sidebar */}
                {currentModule !== 'select-org' && (
                    <div className="hidden md:block h-full">
                        <Sidebar />
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative">
                    <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                        <ErrorBoundary>
                            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
                                {currentModule === 'select-org' && <SelectOrg />}
                                {currentModule === 'dashboard' && <Dashboard />}
                                {currentModule === 'creative' && <CreativeStudio initialMode="image" />}
                                {currentModule === 'legal' && <LegalDashboard />}
                                {currentModule === 'music' && <MusicStudio />}
                                {currentModule === 'marketing' && <MarketingDashboard />}
                                {currentModule === 'video' && <VideoStudio />}
                                {currentModule === 'workflow' && <WorkflowLab />}
                                {currentModule === 'knowledge' && <KnowledgeBase />}
                                {currentModule === 'road' && <RoadManager />}
                                {currentModule === 'social' && <SocialDashboard />}
                                {currentModule === 'brand' && <BrandManager />}
                                {currentModule === 'campaign' && <CampaignDashboard />}
                                {currentModule === 'publicist' && <PublicistDashboard />}
                                {currentModule === 'publishing' && <PublishingDashboard />}
                                {currentModule === 'finance' && <FinanceDashboard />}
                                {currentModule === 'licensing' && <LicensingDashboard />}
                            </Suspense>
                        </ErrorBoundary>
                    </div>

                    {/* Command Bar at Bottom */}
                    {currentModule !== 'select-org' && (
                        <div className="flex-shrink-0 z-10 relative">
                            <ErrorBoundary>
                                <ChatOverlay />
                                <CommandBar />
                            </ErrorBoundary>
                        </div>
                    )}
                </main>

                {/* Right Panel */}
                {currentModule !== 'select-org' && (
                    <RightPanel />
                )}

                {/* Mobile Navigation */}
                {currentModule !== 'select-org' && <MobileNav />}

                {/* DevTools HUD - Only in Development */}
                {import.meta.env.DEV && <TestPlaybookPanel />}
            </div>
        </ToastProvider>
    );
}
