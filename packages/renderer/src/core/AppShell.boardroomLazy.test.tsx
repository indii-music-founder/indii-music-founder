import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boardroomImportSpy = vi.hoisted(() => vi.fn());

const storeState = vi.hoisted(() => ({
    user: { uid: 'artist-1', isAnonymous: false },
    authLoading: false,
    currentModule: 'dashboard',
    userProfile: { id: 'artist-1' },
    setModule: vi.fn(),
    isAgentOpen: false,
    toggleAgentWindow: vi.fn(),
    isSettingsOpen: false,
    setSettingsOpen: vi.fn(),
    isQuickNotesOpen: false,
    setQuickNotesOpen: vi.fn(),
    conversationMode: 'direct' as 'direct' | 'boardroom',
}));

vi.mock('@/modules/boardroom/BoardroomModule', () => {
    boardroomImportSpy();
    return {
        BoardroomModule: () => <div data-testid="lazy-boardroom-module" />,
    };
});

vi.mock('@/modules/dashboard/Dashboard', () => ({
    default: () => <div data-testid="dashboard-module" />,
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: typeof storeState) => unknown) => selector(storeState),
        { getState: () => storeState },
    ),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

vi.mock('react-router-dom', () => ({
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
}));

vi.mock('motion/react', () => ({
    MotionConfig: ({ children }: React.PropsWithChildren) => <>{children}</>,
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    motion: new Proxy({} as Record<string, React.ComponentType<React.PropsWithChildren>>, {
        get: () => ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    }),
}));

vi.mock('@/core/presentMode', () => ({
    usePresentMode: () => false,
    installPresentModeShortcut: () => () => {},
}));

vi.mock('@/services/share/snapshotService', () => ({
    canCaptureSnapshot: () => false,
    captureAndShareSnapshot: vi.fn(),
}));

vi.mock('@/core/components/Sidebar', () => ({ default: () => null }));
vi.mock('@/core/components/RightPanel', () => ({ default: () => null }));
vi.mock('@/components/ui/WorkspaceBackground', () => ({
    WorkspaceBackground: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock('@/core/context/ToastContext', () => ({ ToastProvider: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/context/VoiceContext', () => ({ VoiceProvider: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/context/ThemeContext', () => ({ ThemeProvider: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/components/ModuleErrorBoundary', () => ({ ModuleErrorBoundary: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/components/ModuleAmbientBackground', () => ({ ModuleAmbientBackground: () => null }));
vi.mock('@/core/components/MobileTabBar', () => ({ MobileTabBar: () => null }));
vi.mock('@/core/components/MobileHeader', () => ({ MobileHeader: () => null }));
vi.mock('@/core/components/ApprovalModal', () => ({ ApprovalModal: () => null }));
vi.mock('@/core/components/CostWarningModal', () => ({ default: () => null }));
vi.mock('@/components/ui/AlertDialog', () => ({ AlertDialog: () => null }));
vi.mock('@/components/ui/PromptDialog', () => ({ PromptDialog: () => null }));
vi.mock('@/components/ui/CampaignConfigDialog', () => ({ CampaignConfigDialog: () => null }));
vi.mock('@/components/ui/WalletConnectDialog', () => ({ WalletConnectDialog: () => null }));
vi.mock('@/components/ui/AddTaxCollaboratorDialog', () => ({ AddTaxCollaboratorDialog: () => null }));
vi.mock('@/modules/distribution/components/ConnectDistributorModal', () => ({ default: () => null }));
vi.mock('@/components/ui/CreateCampaignDialog', () => ({ CreateCampaignDialog: () => null }));
vi.mock('@/modules/dashboard/components/NewProjectModal', () => ({ default: () => null }));
vi.mock('@/core/components/auth/BiometricGate', () => ({ BiometricGate: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/providers/ResponsiveLayoutProvider', () => ({ ResponsiveLayoutProvider: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/core/components/ShareTargetHandler', () => ({ ShareTargetHandler: () => null }));
vi.mock('@/utils/moduleDeepLink', () => ({ readModuleDeepLinkFromLocation: () => null }));
vi.mock('@/components/instruments/InstrumentApprovalModal', () => ({ ApprovalManager: () => null }));
vi.mock('@/components/PWAInstallPrompt', () => ({ PWAInstallPrompt: () => null }));
vi.mock('@/config/featureFlags', () => ({ getGatedModuleIds: () => new Set<string>() }));
vi.mock('@/core/components/GatedModuleFallback', () => ({ GatedModuleFallback: () => null }));
vi.mock('@/components/shared/GlobalKeyboardShortcuts', () => ({ GlobalKeyboardShortcuts: () => null }));
vi.mock('@/hooks/useGlobalShortcut', () => ({ useGlobalShortcut: () => {} }));
vi.mock('@/components/shared/UnifiedCommandMenu', () => ({ UnifiedCommandMenu: () => null }));
vi.mock('@/components/shared/GlobalDropZone', () => ({ GlobalDropZone: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock('@/components/shared/UploadQueueMonitor', () => ({ UploadQueueMonitor: () => null }));
vi.mock('@/components/shared/BackgroundJobMonitor', () => ({ BackgroundJobMonitor: () => null }));
vi.mock('@/components/shared/AudioPIPPlayer', () => ({ default: () => null }));
vi.mock('@/core/components/LoadingFallbacks', () => ({ LoadingFallback: () => null }));
vi.mock('@/modules/finance/hooks/useSubscription', () => ({ useSubscription: () => ({ subscription: null, loading: false }) }));
vi.mock('@/core/components/UpdaterMonitor', () => ({ UpdaterMonitor: () => null }));
vi.mock('@/components/shared/CookieConsentBanner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/components/shared/FirstRunTour', () => ({ FirstRunTour: () => null }));
vi.mock('@/services/business-harness/BusinessActivityTracker', () => ({ BusinessActivityTracker: () => null }));
vi.mock('@/components/ui/AgentFeedbackWidget', () => ({ AgentFeedbackWidget: () => null }));
vi.mock('@/core/components/TaskPlanWidget', () => ({ TaskPlanWidget: () => null }));
vi.mock('@/core/components/AgentCanvasPanel', () => ({ AgentCanvasPanel: () => null }));
vi.mock('@/core/components/ChatOverlay', () => ({ default: () => null }));
vi.mock('@/services/observability/SentryService', () => ({ setSentryUser: vi.fn(), clearSentryUser: vi.fn() }));
vi.mock('@/core/context/OrganizationAccessContext', () => ({
    OrganizationAccessProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useOrganizationAccess: () => ({ activeOrganizationId: null, isControlledModule: () => false }),
}));
vi.mock('@/modules/settings/components/SettingsModal', () => ({ SettingsModal: () => null }));
vi.mock('@/modules/notes/components/QuickNotesDrawer', () => ({ QuickNotesDrawer: () => null }));
vi.mock('@/components/layout/SmartNextActionBanner', () => ({ SmartNextActionBanner: () => null }));

import AppShell from '@/core/AppShell';

describe('AppShell Boardroom lazy mount (ISSUE-1643)', () => {
    beforeEach(() => {
        boardroomImportSpy.mockClear();
        storeState.conversationMode = 'direct';
    });

    it('does not load BoardroomModule in direct mode and lazy-loads it when switching to boardroom', async () => {
        const props = {
            activeModule: 'dashboard',
            activeShowChrome: true,
            isDesktop: true,
            isAnyPhone: false,
            shortcutsModal: { isOpen: false, close: vi.fn() },
        };

        const view = render(<AppShell {...props} />);
        expect(screen.queryByTestId('lazy-boardroom-module')).not.toBeInTheDocument();
        expect(boardroomImportSpy).not.toHaveBeenCalled();

        storeState.conversationMode = 'boardroom';
        view.rerender(<AppShell {...props} />);

        await waitFor(() => {
            expect(boardroomImportSpy).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('lazy-boardroom-module')).toBeInTheDocument();
        });
    });
});
