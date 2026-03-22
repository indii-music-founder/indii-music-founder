import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/core/store';
import { isValidModule } from '@/core/constants';
import { useShallow } from 'zustand/react/shallow';

export function useURLSync() {
    const { currentModule, setModule, authLoading } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            setModule: state.setModule,
            authLoading: state.authLoading,
        }))
    );
    const navigate = useNavigate();
    const location = useLocation();

    // Guard: prevent Store→URL from firing before URL→Store has initialized.
    // Without this, deep links like /mobile-remote get overridden by the
    // store's previously-saved module (e.g. 'creative') on first render.
    const hasInitializedFromURL = useRef(false);

    // 1. URL -> Store (Deep Link / Back Button)
    // GUARD: Do not sync URL -> store until auth has fully resolved.
    // Without this guard, navigating to /video on page reload triggers setModule('video')
    // before onAuthStateChanged fires, causing a race between auth re-hydration and the
    // module router — the router sees user=null and flashes <LoginForm/> before auth resolves.
    useEffect(() => {
        if (authLoading) return; // Wait for auth to fully resolve before processing deep links

        const pathSegments = location.pathname.split('/').filter(Boolean);
        const targetModule = pathSegments[0] || 'dashboard';

        if (targetModule !== currentModule && isValidModule(targetModule)) {
            setModule(targetModule);
        }

        // Mark initialization complete after first run
        hasInitializedFromURL.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, setModule, authLoading]);

    // 2. Store -> URL (Navigation)
    // This direction is safe — it only fires when user intentionally changes module via UI.
    // GUARD: Skip until URL→Store has run at least once, to prevent overriding deep links.
    useEffect(() => {
        if (!hasInitializedFromURL.current) return;

        const pathSegments = location.pathname.split('/').filter(Boolean);
        const currentPathModule = pathSegments[0] || 'dashboard';

        if (currentModule !== currentPathModule) {
            const targetUrl = currentModule === 'dashboard' ? '/' : `/${currentModule}`;
            navigate(targetUrl);
        }
        // Remove location.pathname to prevent reverting URL during Back navigation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentModule, navigate]);
}


