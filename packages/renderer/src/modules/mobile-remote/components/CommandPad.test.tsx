import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CommandPad from './CommandPad';

const { mockSetModule, mockSendCommand } = vi.hoisted(() => ({
    mockSetModule: vi.fn(),
    mockSendCommand: vi.fn(),
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
        sendCommand: vi.fn(),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        error: vi.fn(),
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

vi.mock('../MobileRemote', () => ({
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

        expect(mockSetModule).toHaveBeenCalledWith('road');
        expect(mockSendCommand).toHaveBeenCalledWith({
            type: 'navigate',
            payload: { module: 'road' },
        });
    });
});
