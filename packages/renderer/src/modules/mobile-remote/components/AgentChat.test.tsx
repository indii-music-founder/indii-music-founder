import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentChat from './AgentChat';

const mocks = vi.hoisted(() => ({
    sendCommand: vi.fn().mockResolvedValue('command-1'),
    onResponse: vi.fn(() => vi.fn()),
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'exit', 'transition', 'layoutId', 'layout'];
    return Object.fromEntries(Object.entries(props).filter(([key]) => !invalid.includes(key)));
}

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
        callback({ uid: 'user-1' });
        return vi.fn();
    },
}));

vi.mock('@/services/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } } }));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    DESKTOP_HEARTBEAT_STALE_MS: 120_000,
    isFreshStudioState: vi.fn(() => false),
    remoteRelayService: {
        onAllCommands: (callback: (commands: unknown[]) => void) => {
            callback([]);
            return vi.fn();
        },
        onAllResponses: (callback: (responses: unknown[]) => void) => {
            callback([]);
            return vi.fn();
        },
        onDesktopState: (callback: (state: null) => void) => {
            callback(null);
            return vi.fn();
        },
        sendCommand: mocks.sendCommand,
        onResponse: mocks.onResponse,
        cancelCommand: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({
        isListening: false,
        toggleListening: vi.fn(),
        transcript: '',
    }),
}));

vi.mock('@/components/AgentModePicker', () => ({ AgentModePicker: () => <div>Agent picker</div> }));
vi.mock('@/services/commands/EntryCommandRegistry', () => ({ resolveEntryCommand: () => undefined }));
vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('framer-motion', () => {
    const motion = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const Tag = prop as keyof JSX.IntrinsicElements;
                return <Tag {...filterDomProps(props)}>{children}</Tag>;
            };
        },
    });
    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

describe('AgentChat Standby dispatch', () => {
    it('keeps the input enabled and queues a Studio command while presence is stale', async () => {
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired />);
        const input = await screen.findByPlaceholderText('Broadcast to Boardroom…');

        expect(screen.getByText('Studio Standby — Send to Wake')).toBeInTheDocument();
        expect(input).toBeEnabled();

        fireEvent.change(input, { target: { value: 'Wake up and open the session' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        await waitFor(() => {
            expect(mocks.sendCommand).toHaveBeenCalledWith(
                'Wake up and open the session',
                undefined,
                undefined,
                'studio'
            );
        });

        view.unmount();
    });
});
