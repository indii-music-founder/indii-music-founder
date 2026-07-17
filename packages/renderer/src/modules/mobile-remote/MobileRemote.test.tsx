import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MobileRemote from './MobileRemote';

const mockOnAuthStateChanged = vi.fn();
const relayMocks = vi.hoisted(() => ({
    desktopStateCallback: null as ((state: unknown) => void) | null,
    isFreshStudioState: vi.fn(() => true),
    studioStateFreshnessRemainingMs: vi.fn(() => 60_000),
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
    signInWithCustomToken: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: null,
    },
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    DESKTOP_HEARTBEAT_STALE_MS: 1000,
    isFreshStudioState: relayMocks.isFreshStudioState,
    studioStateFreshnessRemainingMs: relayMocks.studioStateFreshnessRemainingMs,
    isPrivateIP: vi.fn(() => false),
    remoteRelayService: {
        isAuthenticated: vi.fn(() => true),
        onDesktopState: vi.fn((callback: (state: unknown) => void) => {
            relayMocks.desktopStateCallback = callback;
            callback({
                currentModule: 'dashboard',
                isAgentProcessing: false,
                activeSessionId: 'studio-session',
                online: true,
                role: 'studio',
                studioInstanceId: 'studio-1',
                listenerReady: true,
                timestamp: { toMillis: () => Date.now() },
            });
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

vi.mock('framer-motion', () => {
    const motionProxy = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const Tag = prop as keyof JSX.IntrinsicElements;
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
        relayMocks.isFreshStudioState.mockReturnValue(true);
        relayMocks.studioStateFreshnessRemainingMs.mockReturnValue(60_000);
        mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown | null) => void) => {
            callback({ uid: 'user-1' });
            return vi.fn();
        });
    });

    afterEach(() => {
        vi.useRealTimers();
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
});
