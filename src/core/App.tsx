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

// Auth Loading Component
const AuthLoading = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <h2 className="text-xl font-semibold">Authenticating...</h2>
        <p className="text-gray-400 mt-2">Please complete sign-in in your browser.</p>
    </div>
);
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
import TestPlaybookPanel from './dev/TestPlaybookPanel'; // This is in src/core/dev
import AudioStressTest from '../dev/AudioStressTest'; // This is in src/dev

export default function App() {
    const { currentModule, initializeHistory, initializeAuth, loadProjects, isAuthReady, isAuthenticated } = useStore();

    useEffect(() => {
        initializeAuth();

        // Handle direct navigation to /select-org
        if (window.location.pathname === '/select-org') {
            useStore.setState({ currentModule: 'select-org' });
        }
    }, [initializeAuth]);

    // Data Load Effect - Only load when authenticated
    useEffect(() => {
        if (isAuthenticated && isAuthReady) {
            console.log("[App] User authenticated, loading data...", { isAuthenticated, isAuthReady });
            initializeHistory();
            loadProjects();
        }
    }, [isAuthenticated, isAuthReady, initializeHistory, loadProjects]);

    // Reset agent open state on mount
    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
    }, []);

    // Auth Guard - Redirect unauthenticated users to login
    useEffect(() => {
        if (isAuthReady && !isAuthenticated) {
            // Use production URL as fallback
            const landingPageUrl = import.meta.env.VITE_LANDING_PAGE_URL || 'https://indiios-v-1-1.web.app/login';

            if (window.electronAPI?.auth) {
                window.electronAPI.auth.login();
            } else {
                console.warn("[App] Electron API not found! Falling back to standard redirect:", landingPageUrl);
                window.location.href = landingPageUrl;
            }
        }
    }, [isAuthReady, isAuthenticated]);

    // Electron Deep Link Auth Listener
    useEffect(() => {
        if (!window.electronAPI?.auth) {
            return;
        }

        const unsubscribe = window.electronAPI.auth.onUserUpdate(async (tokens) => {
            console.log("[App] Received tokens from Electron:", tokens ? "tokens present" : "null");

            // Handle logout signal
            if (!tokens) {
                console.log("[App] Received logout signal from Electron");
                return;
            }

            if (tokens.idToken) {
                try {
                    const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                    const { auth } = await import('@/services/firebase');
                    const credential = GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken);
                    await signInWithCredential(auth, credential);
                    console.log("[App] Successfully signed in with deep link tokens");
                } catch (error) {
                    console.error("[App] Failed to sign in with deep link tokens:", error);
                    // Retry once after a short delay (handles race conditions)
                    setTimeout(async () => {
                        try {
                            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                            const { auth } = await import('@/services/firebase');
                            const credential = GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken);
                            await signInWithCredential(auth, credential);
                            console.log("[App] Retry successful - signed in with deep link tokens");
                        } catch (retryError) {
                            console.error("[App] Retry also failed:", retryError);
                        }
                    }, 1000);
                }
            }
        });

        // Cleanup listener on unmount
        return () => {
            console.log("[App] Cleaning up Electron auth listener");
            unsubscribe();
        };
    }, []);

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
                                {/* Auth Gate */}
                                {(!isAuthReady || !isAuthenticated) ? (
                                    <AuthLoading />
                                ) : (
                                    <>
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
                                    </>
                                )}
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
                {import.meta.env.DEV && (
                    <>
                        <TestPlaybookPanel />
                        <div className="fixed bottom-4 left-4 z-50">
                            <AudioStressTest />
                        </div>
                    </>
                )}
            </div>
        </ToastProvider>
    );
}
