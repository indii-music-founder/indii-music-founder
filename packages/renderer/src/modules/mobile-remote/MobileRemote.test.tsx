import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MobileRemote from './MobileRemote';
import { getRemoteConnectionPhase } from './RemoteConnectionState';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';

const mockOnAuthStateChanged = vi.fn();
const relayMocks = vi.hoisted(() => ({
    desktopStateCallback: null as ((state: unknown) => void) | null,
    desktopStateErrorCallback: null as ((error: unknown) => void) | null,
    emitFreshStateOnSubscribe: true,
    isFreshStudioState: vi.fn(() => true),
    studioStateFreshnessRemainingMs: vi.fn(() => 60_000),
    signInWithCustomToken: vi.fn(),
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'transition', 'layoutId', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithCustomToken: relayMocks.signInWithCustomToken,
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: null,
    },
}));

vi.mock('@/core/config/EndpointService', () => ({
    endpointService: {
        getFunctionUrl: vi.fn(() => 'https://example.test/redeemHandoffCode'),
    },
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    DESKTOP_HEARTBEAT_STALE_MS: 1000,
    isFreshStudioState: relayMocks.isFreshStudioState,
    studioStateFreshnessRemainingMs: relayMocks.studioStateFreshnessRemainingMs,
    isPrivateIP: vi.fn(() => false),
    remoteRelayService: {
        isAuthenticated: vi.fn(() => true),
        onDesktopState: vi.fn((callback: (state: unknown) => void, onError?: (error: unknown) => void) => {
            relayMocks.desktopStateCallback = callback;
            relayMocks.desktopStateErrorCallback = onError ?? null;
            callback(relayMocks.emitFreshStateOnSubscribe ? {
                currentModule: 'dashboard',
                isAgentProcessing: false,
                activeSessionId: 'studio-session',
                online: true,
                role: 'studio',
                studioInstanceId: 'studio-1',
                listenerReady: true,
                timestamp: { toMillis: () => Date.now() },
            } : null);
            return vi.fn();
        }),
        sendCommand: vi.fn(),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('qrcode.react', () => ({
    QRCodeSVG: () => <div data-testid="qr-code" />,
}));

vi.mock('motion/react', () => {
    const motionProxy = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                // ISSUE-1190: `keyof JSX.IntrinsicElements` used to widen to `string` under the
                // old blanket index signature. With real element types it is a union of every
                // tag, so props must satisfy ALL of them (three/drei elements demand `map`).
                // These mocks render a plain DOM tag, so `ElementType` is the accurate cast.
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...filterDomProps(props)}>{children}</Tag>;
            };
        },
    });

    return {
        motion: motionProxy,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

vi.mock('./components/StatusDashboard', () => ({
    default: ({ onTabChange }: { onTabChange?: (tab: string) => void }) => (
        <div>
            <button type="button" onClick={() => onTabChange?.('road')}>
                Home Dashboard
            </button>
        </div>
    ),
}));

vi.mock('./components/QuickCaptureView', () => ({
    default: () => <div>Quick Capture</div>,
}));

vi.mock('./components/StreamView', () => ({
    default: () => <div>Stream View</div>,
}));

vi.mock('./components/SettingsView', () => ({
    default: () => <div>Settings View</div>,
}));

vi.mock('./components/AgentChat', () => ({
    default: () => <div>Agent Chat</div>,
}));

vi.mock('@/modules/touring/components/RoadMode', () => ({
    RoadMode: () => <div>Road Mode Surface</div>,
}));

describe('MobileRemote', () => {
    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        relayMocks.desktopStateCallback = null;
        relayMocks.desktopStateErrorCallback = null;
        relayMocks.emitFreshStateOnSubscribe = true;
        relayMocks.isFreshStudioState.mockReturnValue(true);
        relayMocks.studioStateFreshnessRemainingMs.mockReturnValue(60_000);
        vi.mocked(remoteRelayService.isAuthenticated).mockReturnValue(true);
        mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown | null) => void) => {
            callback({ uid: 'user-1' });
            return vi.fn();
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        window.history.replaceState({}, '', '/');
    });

    it('surfaces Road Mode in the mobile shell', async () => {
        render(<MobileRemote />);

        const roadTab = await screen.findByRole('button', { name: /road/i });
        await waitFor(() => expect(roadTab).toBeEnabled());

        fireEvent.click(roadTab);

        expect(await screen.findByText('Road Mode Surface')).toBeInTheDocument();
    });

    it('keeps a valid pairing interactive when the Studio heartbeat enters Standby', async () => {
        const view = render(<MobileRemote />);
        const roadTab = await screen.findByRole('button', { name: /road/i });
        await waitFor(() => expect(roadTab).toBeEnabled());

        vi.useFakeTimers();
        relayMocks.isFreshStudioState.mockReturnValue(false);

        act(() => {
            relayMocks.desktopStateCallback?.({
                online: true,
                role: 'studio',
                studioInstanceId: 'studio-1',
                listenerReady: true,
                timestamp: { toMillis: () => 0 },
            });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(40_000);
        });

        expect(roadTab).toBeEnabled();
        expect(screen.queryByText('Studio Disconnected')).not.toBeInTheDocument();
        expect(screen.getByText('Standby')).toBeInTheDocument();

        view.unmount();
    });

    it('recreates the Firestore state subscription when the user retries', async () => {
        relayMocks.emitFreshStateOnSubscribe = false;
        relayMocks.isFreshStudioState.mockReturnValue(false);

        render(<MobileRemote />);
        const retry = await screen.findByRole('button', { name: /try reconnecting now/i });
        fireEvent.click(retry);

        await waitFor(() => {
            expect(remoteRelayService.onDesktopState).toHaveBeenCalledTimes(2);
        });
        expect(getRemoteConnectionPhase({
            authenticated: true,
            paired: true,
            reconnecting: true,
            status: 'pairing',
        })).toBe('recovering');
    });

    it('reports a typed error phase when the Firestore listener fails', async () => {
        render(<MobileRemote />);

        act(() => relayMocks.desktopStateErrorCallback?.(new Error('permission-denied')));

        await waitFor(() => {
            expect(document.querySelector('[data-connection-phase="error"]')).toBeInTheDocument();
        });
    });

    it('shows an actionable error instead of a disabled shell for an invalid pairing link', async () => {
        vi.mocked(remoteRelayService.isAuthenticated).mockReturnValue(false);
        mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown | null) => void) => {
            callback(null);
            return vi.fn();
        });
        window.history.replaceState({}, '', '/mobile-remote?code=not-a-valid-code');

        render(<MobileRemote />);

        expect(await screen.findByText('Pairing Link Needed')).toBeInTheDocument();
        expect(screen.getByText(/Generate a new link from Desktop Studio/i)).toBeInTheDocument();
    });

    it('redeems a valid one-click handoff before the phone is already authenticated', async () => {
        vi.mocked(remoteRelayService.isAuthenticated).mockReturnValue(false);
        mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown | null) => void) => {
            callback(null);
            return vi.fn();
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ customToken: 'phone-custom-token' }),
        }));
        window.history.replaceState({}, '', `/mobile-remote?code=${'a'.repeat(64)}`);

        render(<MobileRemote />);

        await waitFor(() => {
            expect(relayMocks.signInWithCustomToken).toHaveBeenCalledWith(
                expect.anything(),
                'phone-custom-token'
            );
        });
        expect(window.location.pathname).toBe('/mobile-remote');
        expect(window.location.search).toBe('');
    });
});
