
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import App from '../core/App';

// Mock matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock the heavy parts of App
vi.mock('../core/store', () => {
    const mockState = {
        user: { uid: 'test-uid' },
        authLoading: false,
        currentModule: 'dashboard',
        setModule: vi.fn(),
        userProfile: { id: 'test-uid', email: 'test@test.com', displayName: 'Test User' },
        isSidebarOpen: true,
        toggleSidebar: vi.fn(),
        isAgentOpen: false,
        toggleAgentWindow: vi.fn(),
        initializeAuthListener: vi.fn(() => () => { }),
        loadUserProfile: vi.fn(),
        initializeHistory: vi.fn(),
        loadProjects: vi.fn(),
        // ISSUE-761: AppInitializationProvider.tsx calls loadNotesFromCloud()
        // on mount (Firestore notes cloud sync) — a real regression caught
        // via CI, not a flake: an incomplete mock throws
        // "loadNotesFromCloud is not a function" when App actually renders.
        loadNotesFromCloud: vi.fn().mockResolvedValue(undefined),
        loadBoardroomMessages: vi.fn().mockResolvedValue(vi.fn()),
        // App.tsx calls loadSessions().catch(...) on mount — must resolve, not return undefined.
        loadSessions: vi.fn().mockResolvedValue(undefined),
        loginWithGoogle: vi.fn(),
        pendingCount: 0,
        isSyncing: false,
        lastSyncError: null,
        boardroomMessages: [],
        addAgentMessage: vi.fn(),
        updateAgentMessage: vi.fn(),
        removeAgentMessage: vi.fn(),
        setPendingCount: vi.fn(),
        setIsSyncing: vi.fn(),
        setLastSyncError: vi.fn(),
        setSidecarStatus: vi.fn(),
        setIsOffline: vi.fn(),
    };

    const useStoreMock = vi.fn((selector?: any) => {
        if (selector && typeof selector === 'function') {
            return selector(mockState);
        }
        return mockState;
    });

    (useStoreMock as any).setState = vi.fn();
    (useStoreMock as any).getState = vi.fn(() => mockState);

    return {
        useStore: useStoreMock,
    };
});

// Mock dynamic import utility to resolve immediately
vi.mock('@/utils/dynamicImport', () => ({
    importWithRetry: (fn: () => Promise<any>) => fn(),
}));

// Mock Dashboard to use useNavigate and verify it runs
vi.mock('../modules/dashboard/Dashboard', () => ({
    default: () => <div>Dashboard Loaded</div>
}));

// Mock ErrorBoundary to just render children so errors bubble up
vi.mock('../core/components/ErrorBoundary', () => ({

    ErrorBoundary: ({ children }: any) => <>{children}</>
}));

// Mock other components
vi.mock('../core/components/Sidebar', () => ({ default: () => <div>Sidebar</div> }));
vi.mock('../core/components/RightPanel', () => ({ default: () => <div>RightPanel</div> }));
vi.mock('../core/components/CommandBar', () => ({ default: () => <div>CommandBar</div> }));

// Silence background async services causing fetch overlap
vi.mock('../core/logger/Logger', () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }
}));
vi.mock('../services/StorageService', () => ({
    StorageService: {
        initialize: vi.fn()
    }
}));
vi.mock('@/modules/finance/hooks/useSubscription', () => ({
    useSubscription: vi.fn().mockReturnValue({
        subscription: null,
        loading: false,
        usage: null,
        error: null,
        refresh: vi.fn(),
        createCheckoutSession: vi.fn(),
        getPortalUrl: vi.fn(),
    })
}));


/**
 * ISSUE-1191: this file previously asserted that the lazy Dashboard finished
 * rendering ("Dashboard Loaded") within a 5s allowance. That conflated a small
 * router-provider contract with the entire App boot — lazy chunks, Suspense,
 * workspace sync, and the memory engine — so under full-suite CPU pressure the
 * Dashboard simply had not resolved in time and the canonical
 * `npm test -- --run` gate exited 1 while the same file passed alone. A longer
 * timeout would only move the threshold, not remove the race.
 *
 * What this file is actually for is narrow and deterministic: App must be able
 * to mount inside a Router without React throwing
 * "useLocation() may be used only in the context of a <Router> component".
 * That is observable at mount time and does not depend on any lazy boundary
 * resolving, so it is asserted directly below.
 *
 * The former negative case (rendering App with no Router inside a try/catch) is
 * intentionally NOT reinstated. React surfaces that failure asynchronously,
 * outside the catch, so the test passed while printing two uncaught exceptions —
 * which trains CI to treat an uncaught React error as acceptable and would let a
 * real router regression hide behind a green run.
 */
describe('Router Context Verification', () => {
    it('mounts App inside a Router without raising a router-context error', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const { container } = render(
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            );

            // The app mounted and produced DOM. Whether the lazy Dashboard has
            // resolved yet is a Suspense-timing detail, not this contract.
            expect(container).not.toBeEmptyDOMElement();

            // The actual contract: no router-context violation at mount.
            const routerErrors = consoleError.mock.calls
                .map(args => args.map(String).join(' '))
                .filter(text => /may be used only in the context of a <Router>/.test(text));
            expect(routerErrors).toEqual([]);
        } finally {
            consoleError.mockRestore();
        }
    });

    it('eventually resolves the lazy dashboard boundary', async () => {
        render(
            <BrowserRouter>
                <App />
            </BrowserRouter>
        );
        // Kept as a separate case so a slow lazy boundary is reported as exactly
        // that, rather than being misread as a router-context failure. Generous
        // timeout because this one legitimately depends on Suspense resolution.
        expect(
            await screen.findByText('Dashboard Loaded', {}, { timeout: 15000 }),
        ).toBeInTheDocument();
    }, 20000);
});
