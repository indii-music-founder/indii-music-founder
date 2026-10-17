import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const state = {
    agentHistory: [],
    isAgentProcessing: false,
    chatChannel: 'specialist',
    isCommandBarDetached: false,
    setCommandBarDetached: vi.fn(),
    agentWindowSize: { width: 480, height: 600 },
    setAgentWindowSize: vi.fn(),
    userProfile: null,
    conversationMode: 'direct',
    directTargetAgentId: 'social',
    activeDepartmentId: null,
    sessions: {},
    activeSessionId: null,
};

vi.mock('@/core/store', () => ({
    useStore: (selector: (store: typeof state) => unknown) => selector(state),
}));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isListening: false, transcript: '' }),
}));
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, drag: _drag, dragControls: _dragControls, dragListener: _dragListener, dragMomentum: _dragMomentum, dragElastic: _dragElastic, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
        button: ({ children, initial: _initial, animate: _animate, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
            <button {...props}>{children}</button>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));
vi.mock('react-virtuoso', () => ({
    Virtuoso: () => <div data-testid="virtuoso" />,
}));
vi.mock('./chat/ChatMessage', () => ({
    MessageItem: () => <div data-testid="message-item" />,
}));
vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="prompt-area" />,
}));
vi.mock('@/core/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock('./AgentSwitcherStrip', () => ({
    AgentSwitcherStrip: () => <div data-testid="agent-switcher" />,
}));

import ChatOverlay from './ChatOverlay';

describe('ChatOverlay clean active header and minimize behavior', () => {
    it('renders the clean indii Direct header and minimizes cleanly', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        expect(screen.getByText('Social Media Director')).toBeInTheDocument();
        expect(screen.getByTestId('agent-switcher')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Minimize chat'));
        expect(screen.getByRole('button', { name: /Social Media Director/i })).toBeInTheDocument();
    });
});
