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
import { useMobile } from '@/hooks/useMobile';
import { useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { useRemoteCommandListener } from '@/hooks/useRemoteCommandListener';
import { useConnectivityMonitor } from '@/hooks/useConnectivityMonitor';
import { useAutoSleep } from '@/hooks/useAutoSleep';
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';
import { cleanupLocalStorage } from '@/lib/storageHealth';
import { flushFounderFunnelQueue } from '@/services/founders/founderFunnel';
import '@/core/i18n'; // Initialize i18next — must run before any component renders
import { AppInitializationProvider } from '@/providers/AppInitializationProvider';

const AppShell = lazy(() => import('./AppShell'));

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

    // Remote Relay: Listen for phone commands and process them through the desktop's agent pipeline
    useRemoteCommandListener();

    // Monitor actual connectivity in Electron — fixes stuck offline state
    useConnectivityMonitor();

    // Auto-sleep the desktop to the tray after configurable idle (Electron only)
    useAutoSleep();

    // Cross-device workspace sync (push/pull, debounced)
    useWorkspaceSync();

    const publicLegalPage = useMemo(() => {
        const path = location.pathname.replace(/\/+$/, '') || '/';
        if (path === '/privacy' || path === '/legal/privacy') return 'privacy';
        if (path === '/terms' || path === '/legal/terms') return 'terms';
        return null;
    }, [location.pathname]);

    // URL sync must not rewrite public legal routes back to a persisted module.
    useURLSync({ disabled: !!publicLegalPage });

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // SSR-safe media query for desktop detection
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const { isAnyPhone } = useMobile();

    // Phone auto-route: on phones, the app IS indiiREMOTE — skip the studio entirely
    useEffect(() => {
        if (isAnyPhone && currentModule !== 'mobile-remote') {
            useStore.getState().setModule('mobile-remote');
        }
    }, [isAnyPhone, currentModule]);

    const activeModule = isAnyPhone ? 'mobile-remote' : currentModule;
    const activeShowChrome = isAnyPhone ? false : showChrome;

    return (
        <AppInitializationProvider>
            {publicLegalPage ? (
                <PublicLegalPage type={publicLegalPage} />
            ) : authLoading ? (
                <LoadingFallback />
            ) : !user ? (
                <UnauthenticatedApp />
            ) : (
                <Suspense fallback={<LoadingFallback />}>
                    <AppShell 
                        activeModule={activeModule} 
                        activeShowChrome={activeShowChrome} 
                        isDesktop={isDesktop} 
                        isAnyPhone={isAnyPhone} 
                        shortcutsModal={shortcutsModal} 
                    />
                </Suspense>
            )}
            {import.meta.env.DEV && <DevPortWarning />}
        </AppInitializationProvider>
    );
}
