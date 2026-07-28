
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


describe('Router Context Verification', () => {
    it('renders App inside BrowserRouter without crashing', async () => {
        render(
            <BrowserRouter>
                <App />
            </BrowserRouter>
        );
        // Use findByText to wait for Suspense to resolve — 5s timeout to handle shard CPU pressure
        expect(await screen.findByText('Dashboard Loaded', {}, { timeout: 5000 })).toBeInTheDocument();
    });
});
