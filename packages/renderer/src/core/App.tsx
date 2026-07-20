import { lazy, Suspense, useEffect, useMemo } from 'react';
import { initSentry } from '@/services/observability/SentryService';

// Initialize Sentry before any rendering — captures mount-phase errors
initSentry();

import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import LoginForm from './components/auth/LoginForm';
import { PrivacyPolicy, TermsOfService } from '@/modules/legal/pages/LegalPages';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { useURLSync } from '@/hooks/useURLSync';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMobile, type MobileState } from '@/hooks/useMobile';
import { useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { useRemoteCommandListener } from '@/hooks/useRemoteCommandListener';
import { useConnectivityMonitor } from '@/hooks/useConnectivityMonitor';
import { useAutoSleep } from '@/hooks/useAutoSleep';
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync';
import { useBugReportShortcut } from '@/modules/debug/useBugReportShortcut';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';
import { cleanupLocalStorage } from '@/lib/storageHealth';
import { flushFounderFunnelQueue } from '@/services/founders/founderFunnel';
import '@/core/i18n'; // Initialize i18next — must run before any component renders
import { AppInitializationProvider } from '@/providers/AppInitializationProvider';

const AppShell = lazy(() => import('./AppShell'));
const BugReportDialog = lazy(() => import('@/modules/debug/BugReportDialog').then(m => ({ default: m.BugReportDialog })));
const InstagramOAuthCallback = lazy(() => import('@/modules/analytics/components/InstagramOAuthCallback').then(m => ({ default: m.InstagramOAuthCallback })));

export function isRemoteSurfaceDevice(
    mobile: Pick<MobileState, 'isAnyPhone' | 'isTablet' | 'isTouchDevice'>
): boolean {
    return mobile.isAnyPhone || (mobile.isTablet && mobile.isTouchDevice);
}

/**
 * The Controller is a command producer, never a Studio executor. This check
 * deliberately excludes a desktop-sized `/mobile-remote` page too; viewport
 * detection alone allowed that page to publish a fake Studio heartbeat.
 */
export function isStudioExecutorSurface(
    currentModule: string,
    shouldUseRemoteSurface: boolean
): boolean {
    return !shouldUseRemoteSurface && currentModule !== 'mobile-remote';
}

function DevPortWarning() {
    const port = window.location.port;
    if (!import.meta.env.DEV || port === '4243') return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-bold border border-red-400 animate-pulse">
            indii.music — Web-Only Mode ({port})
            <br />
            <span className="font-normal opacity-80 text-[10px]">Use port :4243 for full Studio experience</span>
        </div>
    );
}

function PublicLegalPage({ type }: { type: 'privacy' | 'terms' }) {
    return (
        <div className="min-h-screen w-screen overflow-y-auto bg-black text-white">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
                <a href="/" className="text-sm font-semibold text-gray-400 transition-colors hover:text-white">
                    indii.music
                </a>
                <a href="/login" className="text-sm font-semibold text-gray-400 transition-colors hover:text-white">
                    Sign in
                </a>
            </div>
            {type === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
        </div>
    );
}

function UnauthenticatedApp() {
    const location = useLocation();

    useEffect(() => {
        const isRoot = location.pathname === '/' || location.pathname === '';
        const isWebProd = typeof window !== 'undefined' && window.location.hostname === 'founder.indii.music';

        if (isRoot && isWebProd) {
            window.location.replace('https://indii.music');
        }
    }, [location.pathname]);

    const isRoot = location.pathname === '/' || location.pathname === '';
    const isWebProd = typeof window !== 'undefined' && window.location.hostname === 'founder.indii.music';

    if (isRoot && isWebProd) {
        return <LoadingFallback />;
    }

    return <LoginForm />;
}

export default function App() {
    const location = useLocation();
    const { currentModule, user, authLoading } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            user: state.user,
            authLoading: state.authLoading,
        }))
    );

    // Defer non-critical startup work to avoid blocking FCP
    useEffect(() => { cleanupLocalStorage(); }, []);
    useEffect(() => { flushFounderFunnelQueue(); }, []);

    const shortcutsModal = useGlobalShortcutsModal();

    // Bug reporting keyboard shortcuts (Ctrl+Shift+B for bugs, Ctrl+Shift+F for features)
    useBugReportShortcut();

    // Monitor actual connectivity in Electron — fixes stuck offline state
    useConnectivityMonitor();

    // Auto-sleep the desktop to the tray after configurable idle (Electron only)
    useAutoSleep();

    // Cross-device workspace sync (push/pull, debounced)
    useWorkspaceSync();

    // Session metadata and the active session's append-only message stream must
    // be live on every signed-in surface, not only after opening the archive.
    useEffect(() => {
        if (!user) return;
        useStore.getState().loadSessions().catch(error => {
            console.error('[App] Failed to start live agent-session sync:', error);
        });
    }, [user?.uid]);

    const mobile = useMobile();
    const shouldUseRemoteSurface = isRemoteSurfaceDevice(mobile);
    const { isAnyPhone } = mobile;
    const isStudioExecutor = isStudioExecutorSurface(currentModule, shouldUseRemoteSurface);

    // Remote Relay: only the actual Studio surface may publish presence or
    // consume Studio-owned work. Controller pages can only produce commands.
    useRemoteCommandListener(isStudioExecutor);

    const publicLegalPage = useMemo(() => {
        const path = location.pathname.replace(/\/+$/, '') || '/';
        if (path === '/privacy' || path === '/legal/privacy') return 'privacy';
        if (path === '/terms' || path === '/legal/terms') return 'terms';
        return null;
    }, [location.pathname]);
    const isInstagramOAuthCallback = useMemo(
        () => (location.pathname.replace(/\/+$/, '') || '/') === '/auth/instagram/callback',
        [location.pathname],
    );

    // URL sync must not rewrite public legal routes back to a persisted module.
    useURLSync({ disabled: !!publicLegalPage || isInstagramOAuthCallback });

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // SSR-safe media query for desktop detection
    const isDesktop = useMediaQuery('(min-width: 768px)');

    // Remote auto-route: phones and touch-capable tablets use the remote shell instead of studio chrome.
    useEffect(() => {
        if (shouldUseRemoteSurface && currentModule !== 'mobile-remote') {
            useStore.getState().setModule('mobile-remote');
        }
    }, [shouldUseRemoteSurface, currentModule]);

    const activeModule = shouldUseRemoteSurface ? 'mobile-remote' : currentModule;
    const activeShowChrome = shouldUseRemoteSurface ? false : showChrome;

    return (
        <AppInitializationProvider>
            {publicLegalPage ? (
                <PublicLegalPage type={publicLegalPage} />
            ) : authLoading ? (
                <LoadingFallback />
            ) : !user ? (
                <UnauthenticatedApp />
            ) : isInstagramOAuthCallback ? (
                <Suspense fallback={<LoadingFallback />}><InstagramOAuthCallback /></Suspense>
            ) : (
                <Suspense fallback={<LoadingFallback />}>
                    <AppShell
                        activeModule={activeModule}
                        activeShowChrome={activeShowChrome}
                        isDesktop={isDesktop}
                        isAnyPhone={isAnyPhone}
                        shortcutsModal={shortcutsModal}
                    />
                    <BugReportDialog />
                </Suspense>
            )}
            {import.meta.env.DEV && <DevPortWarning />}
        </AppInitializationProvider>
    );
}
