import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentChat from './AgentChat';

const mocks = vi.hoisted(() => ({
    sendCommand: vi.fn().mockResolvedValue('command-1'),
    onResponse: vi.fn(() => vi.fn()),
    uploadFile: vi.fn(),
}));

vi.mock('@/services/StorageService', () => ({ StorageService: { uploadFile: mocks.uploadFile } }));
vi.mock('@/core/components/command-bar/LiveConversationButton', () => ({
    LiveConversationButton: ({ startOptions }: { startOptions: { onCommitTurn: (text: string) => void } }) => (
        <button type="button" onClick={() => startOptions.onCommitTurn('Voice message')}>Commit voice</button>
    ),
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

vi.mock('@/services/firebase', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        auth: { currentUser: { uid: 'user-1' } },
        remoteConfig: actual?.remoteConfig ?? {},
        functions: actual?.functions ?? {},
        db: actual?.db ?? {},
    };
});

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
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('motion/react', () => {
    const motion = new Proxy({}, {
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
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

describe('AgentChat Standby dispatch', () => {
    it('waits for a selected attachment before allowing the message to send', async () => {
        let finish!: (url: string) => void;
        mocks.uploadFile.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired />);
        const text = await screen.findByPlaceholderText('Broadcast to Boardroom…');
        fireEvent.change(text, { target: { value: 'Look at this' } });
        const fileInput = view.container.querySelector('input[type="file"]')!;
        fireEvent.change(fileInput, { target: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } });
        expect(await screen.findByRole('status')).toHaveTextContent('Uploading attachment');
        expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
        fireEvent.keyDown(text, { key: 'Enter', code: 'Enter' });
        expect(mocks.sendCommand).not.toHaveBeenCalled();
        finish('https://example.test/cover.png');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
        await waitFor(() => expect(mocks.sendCommand).toHaveBeenCalledWith('Look at this', undefined, expect.any(Object), 'studio', [expect.objectContaining({ name: 'cover.png' })]));
        view.unmount();
    });

    it('shows an actionable error when an attachment upload fails', async () => {
        mocks.uploadFile.mockRejectedValueOnce(new Error('offline'));
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired />);
        const input = view.container.querySelector('input[type="file"]');
        expect(input).not.toBeNull();
        fireEvent.change(input!, { target: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('Attachment could not be uploaded');
        view.unmount();
    });

    it('keeps a voice transcript when an attachment is still uploading', async () => {
        let finish!: (url: string) => void;
        mocks.uploadFile.mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve; }));
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired />);
        const text = await screen.findByPlaceholderText('Broadcast to Boardroom…');
        fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(['image'], 'cover.png', { type: 'image/png' })] } });
        await screen.findByRole('status');
        fireEvent.click(screen.getByRole('button', { name: 'Commit voice' }));
        expect(mocks.sendCommand).not.toHaveBeenCalled();
        expect(text).toHaveValue('Voice message');
        expect(screen.getByRole('alert')).toHaveTextContent('Wait for the attachment');
        finish('https://example.test/cover.png');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled());
        view.unmount();
    });

    it('sends staged attachments with a voice turn', async () => {
        const attachment = { url: 'https://example.test/cover.png', mimeType: 'image/png', name: 'cover.png' };
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired initialAttachment={attachment} />);
        await screen.findByPlaceholderText('Broadcast to Boardroom…');
        fireEvent.click(screen.getByRole('button', { name: 'Commit voice' }));
        await waitFor(() => expect(mocks.sendCommand).toHaveBeenCalledWith(
            'Voice message', undefined, expect.objectContaining({ attachments: [attachment] }), 'studio', [attachment],
        ));
        view.unmount();
    });

    it('restores the voice transcript and attachment when sending fails', async () => {
        mocks.sendCommand.mockRejectedValueOnce(new Error('offline'));
        const attachment = { url: 'https://example.test/cover.png', mimeType: 'image/png', name: 'cover.png' };
        const view = render(<AgentChat onSendCommand={vi.fn()} isPaired initialAttachment={attachment} />);
        const text = await screen.findByPlaceholderText('Broadcast to Boardroom…');
        fireEvent.click(screen.getByRole('button', { name: 'Commit voice' }));
        await waitFor(() => expect(text).toHaveValue('Voice message'));
        expect(screen.getByText('cover.png')).toBeInTheDocument();
        view.unmount();
    });

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
                // The Controller must tell the desktop which mode THIS surface
                // selected; the desktop no longer routes by its own UI state.
                expect.objectContaining({ conversationMode: 'boardroom' }),
                'studio'
            );
        });

        view.unmount();
    });
});
