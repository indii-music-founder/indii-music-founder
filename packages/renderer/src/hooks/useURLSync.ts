import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/core/store';
import { isValidModule } from '@/core/constants';
import { useShallow } from 'zustand/react/shallow';

interface URLSyncOptions {
    disabled?: boolean;
}

const PUBLIC_ROUTE_SEGMENTS = new Set(['privacy', 'terms', 'legal']);
const VIDEO_ROUTE_SEGMENTS = new Set(['video', 'video-producer', 'video-studio']);

const ROUTE_ALIASES: Record<string, string> = {
    'controller': 'mobile-remote',
    'remote': 'mobile-remote',
    'social-media': 'social',
    'socials': 'social',
    'video': 'creative',
    'video-producer': 'creative',
    'video-studio': 'creative',
    'creative-director': 'creative',
};

function resolvePathModule(pathSegment: string): string {
    return ROUTE_ALIASES[pathSegment] ?? pathSegment;
}

export function useURLSync(options: URLSyncOptions = {}) {
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
    const pendingPathModule = useRef<string | null>(null);

    // 1. URL -> Store (Deep Link / Back Button)
    // GUARD: Do not sync URL -> store until auth has fully resolved.
    // Without this guard, navigating to /video on page reload triggers setModule('video')
    // before onAuthStateChanged fires, causing a race between auth re-hydration and the
    // module router — the router sees user=null and flashes <LoginForm/> before auth resolves.
    useEffect(() => {
        if (options.disabled) return;
        if (authLoading) return; // Wait for auth to fully resolve before processing deep links

        const pathSegments = location.pathname.split('/').filter(Boolean);
        if (PUBLIC_ROUTE_SEGMENTS.has(pathSegments[0] || '')) {
            hasInitializedFromURL.current = false;
            return;
        }
        const targetModule = resolvePathModule(pathSegments[0] || 'dashboard');

        if (targetModule !== currentModule && isValidModule(targetModule)) {
            pendingPathModule.current = targetModule;
            setModule(targetModule);
        } else {
            pendingPathModule.current = null;
        }

        // Mark initialization complete after first run
        hasInitializedFromURL.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, setModule, authLoading, options.disabled]);

    // 2. Store -> URL (Navigation)
    // This direction is safe — it only fires when user intentionally changes module via UI.
    // GUARD: Skip until URL→Store has run at least once, to prevent overriding deep links.
    useEffect(() => {
        if (options.disabled) return;
        if (!hasInitializedFromURL.current) return;

        const pathSegments = location.pathname.split('/').filter(Boolean);
        if (PUBLIC_ROUTE_SEGMENTS.has(pathSegments[0] || '')) return;
        const pathSegment = pathSegments[0] || 'dashboard';
        const currentPathModule = resolvePathModule(pathSegment);

        // URL -> Store owns valid deep links and Back/Forward navigation. Do
        // not let the stale store value rewrite the route in the same effect
        // cycle before Zustand publishes the new module.
        if (
            pendingPathModule.current === currentPathModule
            && currentModule !== currentPathModule
        ) return;
        if (pendingPathModule.current === currentModule) {
            pendingPathModule.current = null;
        }

        // Preserve legacy video deep links while converging on one canonical
        // route. Video is a mode of CreativeStudio, not a standalone module.
        if (currentModule === 'creative' && VIDEO_ROUTE_SEGMENTS.has(pathSegment)) {
            navigate('/creative/video', { replace: true });
            return;
        }

        if (currentModule !== currentPathModule) {
            navigate(currentModule === 'dashboard' ? '/' : `/${currentModule}`);
        }
        // Remove location.pathname to prevent reverting URL during Back navigation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentModule, navigate, options.disabled]);
}
