import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommandPad from '@/modules/mobile-remote/components/CommandPad';

const { mockSetModule, mockSendCommand, mockRelaySendCommand } = vi.hoisted(() => ({
    mockSetModule: vi.fn(),
    mockSendCommand: vi.fn<(...args: unknown[]) => void | Promise<string | null | void>>(),
    mockRelaySendCommand: vi.fn<(...args: unknown[]) => Promise<string | null>>(async () => 'cmd-hub-1'),
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'transition'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: { setModule: typeof mockSetModule }) => unknown) =>
        selector({ setModule: mockSetModule }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (selector: unknown) => selector,
}));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        sendCommand: mockRelaySendCommand,
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('motion/react', () => ({
    motion: {
        button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <button {...filterDomProps(props)}>{children}</button>
        ),
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...filterDomProps(props)}>{children}</div>
        ),
    },
}));

vi.mock('@/modules/mobile-remote/MobileRemote', () => ({
    triggerHaptic: vi.fn(),
}));

describe('CommandPad', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes a Road Mode quick action that targets touring', () => {
        render(<CommandPad onSendCommand={mockSendCommand} isPaired={true} />);

        const roadButton = screen.getByRole('button', { name: /road mode/i });
        expect(roadButton).toBeInTheDocument();

        fireEvent.click(roadButton);

        expect(mockSetModule).not.toHaveBeenCalled();
        expect(mockSendCommand).toHaveBeenCalledWith({
            type: 'navigate',
            payload: { module: 'road' },
        });
    });

    it('keeps relay shortcuts unavailable while the phone is unpaired', () => {
        render(<CommandPad onSendCommand={mockSendCommand} isPaired={false} />);
        const roadButton = screen.getByRole('button', { name: /road mode/i });
        expect(roadButton).toBeDisabled();
        fireEvent.click(roadButton);
        expect(mockSendCommand).not.toHaveBeenCalled();
        expect(screen.queryByText('CPU 12%')).not.toBeInTheDocument();
    });

    it('dispatches a Hub Control Centre card via relay and opens Boardroom Agent Chat', async () => {
        const onOpenChat = vi.fn();
        render(<CommandPad onSendCommand={mockSendCommand} isPaired={true} onOpenChat={onOpenChat} activeDesktopModule="music" />);

        const audioButton = screen.getByRole('button', { name: /audio/i });
        expect(audioButton).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: /next release/i }));

        await waitFor(() => {
            expect(mockRelaySendCommand).toHaveBeenCalledWith(
                expect.stringContaining('Auditing pre-release readiness checks'),
                undefined,
                { conversationMode: 'boardroom', source: 'mobile-remote' },
                'studio'
            );
            expect(onOpenChat).toHaveBeenCalledWith('cmd-hub-1');
        });
    });

    it('renders an alert and does not open chat when relay sendCommand returns null', async () => {
        const onOpenChat = vi.fn();
        mockRelaySendCommand.mockResolvedValueOnce(null);
        render(<CommandPad onSendCommand={mockSendCommand} isPaired={true} onOpenChat={onOpenChat} />);

        fireEvent.click(screen.getByRole('button', { name: /next release/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Studio did not accept the command.');
        });
        expect(onOpenChat).not.toHaveBeenCalled();
    });

    it('renders an alert when module navigation returns null from relay', async () => {
        mockSendCommand.mockResolvedValueOnce(null);
        render(<CommandPad onSendCommand={mockSendCommand} isPaired={true} />);

        fireEvent.click(screen.getByRole('button', { name: /finance/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Studio did not accept the navigation command.');
        });
    });
});
