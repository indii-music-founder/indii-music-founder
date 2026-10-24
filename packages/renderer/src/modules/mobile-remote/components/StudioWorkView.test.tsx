import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StudioWorkView from './StudioWorkView';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('./AgentChat', () => ({
    default: () => <div data-testid="agent-chat-stub">Agent Chat Embedded</div>,
}));
vi.mock('./GenerationMonitor', async (importOriginal) => ({
    ...await importOriginal<typeof import('./GenerationMonitor')>(),
    default: ({ isPaired }: { isPaired: boolean }) => <div data-testid="generation-monitor">{isPaired ? 'Paired generator' : 'Offline generator'}</div>,
}));
vi.mock('./CommandPad', () => ({
    default: ({ isPaired }: { isPaired: boolean }) => <div data-testid="command-pad">{isPaired ? 'Paired actions' : 'Offline actions'}</div>,
}));

let mockResponsesCallback: ((resps: unknown[]) => void) | null = null;

vi.mock('@/services/agent/RemoteRelayService', () => ({
    remoteRelayService: {
        onAllCommands: vi.fn((cb) => {
            cb([]);
            return () => {};
        }),
        onAllResponses: vi.fn((cb) => {
            mockResponsesCallback = cb;
            cb([]);
            return () => {};
        }),
        sendCommand: vi.fn(() => Promise.resolve('cmd-123')),
    },
}));

describe('StudioWorkView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResponsesCallback = null;
    });

    it('renders subtabs and shows empty state when no outputs exist', () => {
        render(<StudioWorkView isPaired={true} />);

        expect(screen.getByText('Flyers & Outputs')).toBeDefined();
        expect(screen.getByText('Agent Chat')).toBeDefined();
        expect(screen.getByText('No Studio Outputs Yet')).toBeDefined();
    });

    it('displays image output cards when relay responses contain imageUrls', async () => {
        render(<StudioWorkView isPaired={true} />);

        // Simulate new response with image wrapped in act
        act(() => {
            mockResponsesCallback?.([
                {
                    id: 'resp_1',
                    commandId: 'cmd_1',
                    text: 'Friday Night Show Flyer',
                    imageUrls: ['https://example.com/flyer1.png'],
                    timestamp: Date.now(),
                },
            ]);
        });

        await waitFor(() => {
            expect(screen.getByText('Friday Night Show Flyer')).toBeDefined();
            const img = screen.getByRole('img');
            expect(img.getAttribute('src')).toBe('https://example.com/flyer1.png');
        });
    });

    it('switches to Agent Chat sub-tab', async () => {
        render(<StudioWorkView isPaired={true} />);

        fireEvent.click(screen.getByText('Agent Chat'));

        await waitFor(() => {
            expect(screen.getByTestId('agent-chat-stub')).toBeDefined();
        });
    });

    it('exposes generation presets and actions from the studio navigation', async () => {
        render(<StudioWorkView isPaired={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
        await waitFor(() => expect(screen.getByTestId('generation-monitor')).toHaveTextContent('Offline generator'));

        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
        await waitFor(() => expect(screen.getByTestId('command-pad')).toHaveTextContent('Offline actions'));
    });

    it('submits a flyer generation request to desktop studio', async () => {
        render(<StudioWorkView isPaired={true} />);

        const input = screen.getByPlaceholderText('Create a flyer for Friday night show...');
        fireEvent.change(input, {
            target: { value: 'Tour kick-off in Chicago' },
        });

        fireEvent.submit(input.closest('form')!);

        await waitFor(() => {
            expect(remoteRelayService.sendCommand).toHaveBeenCalledWith(
                '[GENERATE_IMAGE] Tour kick-off in Chicago',
                'creative',
                expect.objectContaining({
                    type: 'generate_image',
                    aspectRatio: '4:5',
                })
            );
        });
    });
});
