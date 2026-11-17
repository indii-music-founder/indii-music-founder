import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsView from './SettingsView';
import type { DesktopState } from '@/services/agent/RemoteRelayService';

const mocks = vi.hoisted(() => ({
    onSnapshot: vi.fn(),
    setDoc: vi.fn(),
    requestPermission: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    onSnapshot: (...args: unknown[]) => mocks.onSnapshot(...args),
    setDoc: (...args: unknown[]) => mocks.setDoc(...args),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user-1' } },
    db: {},
}));

vi.mock('@/services/notifications/PushNotificationService', () => ({
    pushNotificationService: {
        isSupported: vi.fn(() => false),
        getPermissionStatus: vi.fn(() => 'default'),
        getStatus: vi.fn(() => ({ supported: false, enabled: false })),
        requestPermissionAndRegister: (...args: unknown[]) => mocks.requestPermission(...args),
    },
}));

vi.mock('@/services/agent/RemoteRelayService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/agent/RemoteRelayService')>();
    return {
        ...actual,
        remoteRelayService: {
            ...actual.remoteRelayService,
            sendCommand: vi.fn().mockResolvedValue('cmd-wake'),
        },
    };
});

vi.mock('../haptics', () => ({
    triggerHaptic: vi.fn(),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
        button: ({ children, whileTap, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>> & Record<string, unknown>) => (
            <button type="button" {...props}>{children}</button>
        ),
    },
}));

describe('SettingsView Jev integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.onSnapshot.mockImplementation(() => vi.fn());
    });

    it('renders JevRemoteHintBar on More tab and navigates to Capture when online', async () => {
        const onNavigateTab = vi.fn();
        render(
            <SettingsView
                desktopState={{
                    online: true,
                    role: 'studio',
                    studioInstanceId: 'studio-1',
                    listenerReady: true,
                    timestamp: { toMillis: () => Date.now() },
                    currentModule: 'dashboard',
                    isAgentProcessing: false,
                    activeSessionId: 's1',
                } as unknown as DesktopState}
                isPaired={true}
                onNavigateTab={onNavigateTab}
            />
        );

        const hintBar = await screen.findByTestId('jev-remote-hint-bar');
        expect(hintBar).toHaveTextContent(/Jev/i);

        fireEvent.click(screen.getByTestId('jev-remote-hint-action'));
        expect(onNavigateTab).toHaveBeenCalledWith('home');
    });

    it('surfaces Wake Studio First from Jev when Desktop power state is sleeping', async () => {
        render(
            <SettingsView
                desktopState={{
                    online: true,
                    role: 'studio',
                    studioInstanceId: 'studio-1',
                    listenerReady: true,
                    sleepMode: true,
                    timestamp: { toMillis: () => Date.now() },
                    currentModule: 'dashboard',
                    isAgentProcessing: false,
                    activeSessionId: 's1',
                } as unknown as DesktopState}
                isPaired={true}
            />
        );

        const actionBtn = await screen.findByTestId('jev-remote-hint-action');
        expect(actionBtn).toHaveTextContent('Wake Studio First');
    });
});

describe('SettingsView saving settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.onSnapshot.mockImplementation(() => vi.fn());
    });

    const renderView = () => render(
        <SettingsView
            desktopState={{ online: true, sleepMode: false } as unknown as DesktopState}
            isRelayOnline
            onNavigate={vi.fn()}
        />
    );

    it('keeps the toggle in sync with what was stored when the write fails', async () => {
        mocks.setDoc.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
        renderView();
        const toggle = screen.getByText('Auto-sleep').closest('button')!;
        const before = toggle.querySelector('span.rounded-full')!.className;

        fireEvent.click(toggle);

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your remote settings');
        expect(toggle.querySelector('span.rounded-full')!.className).toBe(before);
    });

    it('shows no error when the write succeeds', async () => {
        mocks.setDoc.mockResolvedValueOnce(undefined);
        renderView();
        fireEvent.click(screen.getByText('Auto-sleep').closest('button')!);
        await Promise.resolve();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
