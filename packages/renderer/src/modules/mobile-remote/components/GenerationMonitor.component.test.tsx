/**
 * Structural component tests for GenerationMonitor lifecycle primitives.
 * Relay service and store are mocked; these checks verify timer/listener cleanup,
 * unmount cancellation, timeout error recovery, and superseding-command isolation
 * rather than live Firestore or image generation execution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import GenerationMonitor from './GenerationMonitor';

const mockSendCommand = vi.hoisted(() => vi.fn());
const mockCancelCommand = vi.hoisted(() => vi.fn());
const mockOnResponse = vi.hoisted(() => vi.fn());
const mockOnAllCommands = vi.hoisted(() => vi.fn(() => vi.fn()));
const mockOnAllResponses = vi.hoisted(() => vi.fn(() => vi.fn()));

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        sendCommand: mockSendCommand,
        cancelCommand: mockCancelCommand,
        onResponse: mockOnResponse,
        onAllCommands: mockOnAllCommands,
        onAllResponses: mockOnAllResponses,
    },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({
            isGenerating: false,
            prompt: '',
            currentModule: 'dashboard',
            isAgentProcessing: false,
        }),
}));

describe('GenerationMonitor lifecycle primitives', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOnAllCommands.mockReturnValue(vi.fn());
        mockOnAllResponses.mockReturnValue(vi.fn());
        mockOnResponse.mockReturnValue(vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('cancels the command and attaches no listener if unmounted while sendCommand is in flight', async () => {
        let resolveSend!: (id: string) => void;
        mockSendCommand.mockImplementation(() => new Promise<string>((resolve) => {
            resolveSend = resolve;
        }));
        mockCancelCommand.mockResolvedValue(true);

        const view = render(<GenerationMonitor isPaired={true} />);
        const input = screen.getByPlaceholderText('Describe visual concept…');
        fireEvent.change(input, { target: { value: 'neon album cover' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));

        expect(mockSendCommand).toHaveBeenCalledTimes(1);

        // Unmount before sendCommand resolves
        view.unmount();
        resolveSend('cmd-orphaned');
        await new Promise((r) => setTimeout(r, 20));

        expect(mockOnResponse).not.toHaveBeenCalled();
        expect(mockCancelCommand).toHaveBeenCalledWith('cmd-orphaned');
    });

    it('catches cancelCommand rejection during the 90s timeout and surfaces an alert', async () => {
        vi.useFakeTimers();
        const unsubResponse = vi.fn();
        mockSendCommand.mockResolvedValue('cmd-timeout');
        mockOnResponse.mockReturnValue(unsubResponse);
        mockCancelCommand.mockRejectedValue(new Error('network unavailable'));

        render(<GenerationMonitor isPaired={true} />);
        const input = screen.getByPlaceholderText('Describe visual concept…');
        fireEvent.change(input, { target: { value: 'chrome vinyl sleeve' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));

        await act(async () => {
            await Promise.resolve();
        });
        expect(mockOnResponse).toHaveBeenCalledWith('cmd-timeout', expect.any(Function));

        // Trigger the 90s timeout
        await act(async () => {
            await vi.advanceTimersByTimeAsync(90_000);
        });

        expect(unsubResponse).toHaveBeenCalled();
        expect(mockCancelCommand).toHaveBeenCalledWith('cmd-timeout');
        expect(screen.getByRole('alert')).toHaveTextContent(
            /timed out.*cancellation could not be confirmed/i
        );
    });

    it('does not let a slow cancelCommand from a prior request clobber a newly started generation', async () => {
        let resolveCancel!: (cancelled: boolean) => void;
        mockSendCommand
            .mockResolvedValueOnce('cmd-1')
            .mockResolvedValueOnce('cmd-2');
        mockCancelCommand.mockImplementation(() => new Promise<boolean>((resolve) => {
            resolveCancel = resolve;
        }));

        render(<GenerationMonitor isPaired={true} />);
        const input = screen.getByPlaceholderText('Describe visual concept…');
        fireEvent.change(input, { target: { value: 'first prompt' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel pending request' })).toBeEnabled());

        // Cancel cmd-1 (cancelCommand stays pending)
        fireEvent.click(screen.getByRole('button', { name: 'Cancel pending request' }));
        expect(mockCancelCommand).toHaveBeenCalledWith('cmd-1');

        // Immediately start cmd-2 while cmd-1 cancellation is still in flight
        fireEvent.change(input, { target: { value: 'second prompt' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate image' }));
        await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));

        // Now cmd-1 cancellation resolves — must NOT display stale error over cmd-2
        resolveCancel(true);
        await new Promise((r) => setTimeout(r, 20));

        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('prevents rapid double-submit before React re-renders isSending', async () => {
        let resolveSend!: (id: string) => void;
        mockSendCommand.mockImplementation(() => new Promise<string>((resolve) => {
            resolveSend = resolve;
        }));
        mockCancelCommand.mockResolvedValue(true);

        const view = render(<GenerationMonitor isPaired={true} />);
        const input = screen.getByPlaceholderText('Describe visual concept…');
        fireEvent.change(input, { target: { value: 'double tap prompt' } });
        const sendBtn = screen.getByRole('button', { name: 'Generate image' });
        fireEvent.click(sendBtn);
        fireEvent.click(sendBtn);

        expect(mockSendCommand).toHaveBeenCalledTimes(1);

        view.unmount();
        resolveSend('cmd-single');
        await new Promise((r) => setTimeout(r, 10));
    });
});
