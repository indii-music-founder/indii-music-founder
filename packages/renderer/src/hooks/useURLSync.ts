import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/core/store';
import { isValidModule } from '@/core/constants';
import { useShallow } from 'zustand/react/shallow';

interface URLSyncOptions {
    disabled?: boolean;
}

// `/legal` is the signed-in Legal Department module. Public legal documents
// (`/legal/privacy` and `/legal/terms`) are intercepted by App before the
// authenticated Studio — and this hook — mounts, so excluding the entire
// `legal` segment here breaks a direct reload of the department route.
const PUBLIC_ROUTE_SEGMENTS = new Set(['privacy', 'terms']);
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
    'knowledge-base': 'knowledge',
    'audio-analyzer': 'distribution',
    'format-foundry': 'finance',
};

function resolvePathModule(pathSegment: string): string {
    return ROUTE_ALIASES[pathSegment] ?? pathSegment;
}

/**
 * ISSUE-1439: modules whose active tab lives in the Zustand store are
 * URL-addressable via `?tab=`. The `tab` value only round-trips for these
 * modules — every other module keeps its tab as local component state, which
 * is out of scope for URL sync.
 */
interface TabStateConfig {
    read: (s: { distributionTab?: string; financeTab?: string }) => string | undefined;
    apply: (
        s: { setDistributionTab: (tab: string) => void; setFinanceTab: (tab: string) => void },
        tab: string
    ) => void;
    field: 'distributionTab' | 'financeTab';
    defaultTab: string;
}

const TAB_STATE: Record<string, TabStateConfig> = {
    'distribution': {
        read: (s) => s.distributionTab,
        apply: (s, tab) => s.setDistributionTab(tab),
        field: 'distributionTab',
        defaultTab: 'releases',
    },
    'finance': {
        read: (s) => s.financeTab,
        apply: (s, tab) => s.setFinanceTab(tab),
        field: 'financeTab',
        defaultTab: 'overview',
    },
};

function buildUrl(pathname: string, search: string, tab: string | null): string {
    const params = new URLSearchParams(search);
    if (tab) {
        params.set('tab', tab);
    } else {
        params.delete('tab');
    }
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
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

    // The active tab for the current module, when it is store-backed. Re-runs the
    // Store→URL effect whenever the user switches tabs inside the module.
    const activeTab = useStore((state) => {
        const config = TAB_STATE[currentModule as string];
        return config ? config.read(state) : undefined;
    });

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
        const rawSegment = pathSegments[0] || 'dashboard';
        const targetModule = resolvePathModule(rawSegment);
        const aliasTab = rawSegment === 'audio-analyzer' ? 'qc' : rawSegment === 'format-foundry' ? 'forensics' : undefined;
        // ISSUE-1439: an explicit `?tab=` always wins over the legacy alias tab.
        const urlTab = new URLSearchParams(location.search).get('tab') || undefined;
        const effectiveTab = urlTab ?? aliasTab;

        if (targetModule !== currentModule && isValidModule(targetModule)) {
            pendingPathModule.current = targetModule;
            if (effectiveTab) {
                setModule(targetModule, { tab: effectiveTab });
            } else {
                setModule(targetModule);
            }
        } else {
            pendingPathModule.current = null;
            // Same-module navigation (Back/Forward or manual URL edit): apply the
            // addressed tab, but only when it actually differs to avoid set loops.
            const config = TAB_STATE[targetModule];
            if (effectiveTab && config) {
                const store = useStore.getState() as unknown as Record<string, unknown> & {
                    setDistributionTab: (tab: string) => void;
                    setFinanceTab: (tab: string) => void;
                };
                if (store[config.field] !== effectiveTab) {
                    config.apply(store, effectiveTab);
                }
            }
        }

        // Mark initialization complete after first run
        hasInitializedFromURL.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, location.search, setModule, authLoading, options.disabled]);

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
            // Module switch: carry the store-backed tab on the URL when it is
            // non-default so a mid-flow refresh or share keeps the context.
            const config = TAB_STATE[currentModule as string];
            const tab = config ? (activeTab ?? config.defaultTab) : null;
            const carried = config && tab && tab !== config.defaultTab ? tab : null;
            navigate(buildUrl(currentModule === 'dashboard' ? '/' : `/${currentModule}`, location.search, carried));
            return;
        }

        // Same module: mirror store-backed tab changes into `?tab=` (replace, so
        // tab switches don't spam history entries).
        const config = TAB_STATE[currentModule as string];
        if (config) {
            const currentTabParam = new URLSearchParams(location.search).get('tab');
            const desired = activeTab && activeTab !== config.defaultTab ? activeTab : null;
            if ((activeTab ?? config.defaultTab) !== (currentTabParam ?? config.defaultTab)) {
                navigate(buildUrl(location.pathname, location.search, desired), { replace: true });
            }
        } else if (new URLSearchParams(location.search).get('tab')) {
            // Switched to a module without URL-addressable tabs — drop a stale param.
            navigate(buildUrl(location.pathname, location.search, null), { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentModule, activeTab, navigate, options.disabled]);
}
