import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

const mockSendMessage = vi.fn();

vi.mock('@/services/agent/AgentService', () => ({
  agentService: { sendMessage: (...args: any[]) => mockSendMessage(...args) },
}));

vi.mock('@/services/agent/registry', () => ({
  agentRegistry: {
    getAll: () => [
      { id: 'manager', name: 'Manager', category: 'manager' },
      { id: 'creative', name: 'Creative', category: 'department' }
    ],
  },
}));

vi.mock('@/services/ai/VoiceService', () => ({
  voiceService: {
    isSupported: () => true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Use vi.hoisted to create mutable store state accessible to the mock factory
const storeState = vi.hoisted(() => ({
  currentModule: 'dashboard',
  setModule: vi.fn(),
  toggleAgentWindow: vi.fn(),
  isAgentOpen: false,
  chatChannel: 'agent',
  setChatChannel: vi.fn(),
  isCommandBarDetached: false,
  setCommandBarDetached: vi.fn(),
  commandBarInput: 'test command',
  setCommandBarInput: vi.fn(),
  commandBarAttachments: [] as any[],
  setCommandBarAttachments: vi.fn(),
  activeAgentProvider: undefined,
  setActiveAgentProvider: vi.fn(),
  isKnowledgeBaseEnabled: false,
  setKnowledgeBaseEnabled: vi.fn(),
}));

vi.mock('@/core/store', () => ({
  useStore: (selector: any) => selector(storeState),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

import { PromptArea } from './PromptArea';

describe('PromptArea State Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    storeState.commandBarInput = 'test command';
    storeState.commandBarAttachments = [];
    storeState.isAgentOpen = false;
    storeState.currentModule = 'dashboard';
    storeState.chatChannel = 'agent';
    storeState.isCommandBarDetached = false;
  });

  it('shows loading state during submission', async () => {
    // Setup delayed promise
    let resolveMessage: (value?: unknown) => void;
    const messagePromise = new Promise((resolve) => {
      resolveMessage = resolve;
    });
    mockSendMessage.mockReturnValue(messagePromise);

    render(<PromptArea />);

    // Verify initial state: Button enabled (due to input), No loader
    const runBtn = screen.getByTestId('command-bar-run-btn');
    expect(runBtn).not.toBeDisabled();
    expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument();

    // Click run
    fireEvent.click(runBtn);

    // Verify loading state: Loader visible
    expect(screen.getByTestId('run-loader')).toBeInTheDocument();

    // Also verify the button is disabled while processing
    expect(runBtn).toBeDisabled();

    // Resolve the promise
    await act(async () => {
      resolveMessage!();
    });

    // Verify success state: Loader gone, input cleared
    expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument();
    expect(runBtn).toBeDisabled(); // Disabled because input is cleared
  });
});
