import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PromptArea as PromptAreaType } from './PromptArea';

// --- MOCKS ---

// Mock Toast
const mockToastError = vi.fn();
vi.mock('@/core/context/ToastContext', () => ({
  useToast: () => ({ error: mockToastError, success: vi.fn() }),
}));

// Mock AgentService to REJECT
const mockSendMessage = vi.fn();
vi.mock('@/services/agent/AgentService', () => ({
  agentService: { sendMessage: (...args: any[]) => mockSendMessage(...args) },
}));

// Mock Registry
vi.mock('@/services/agent/registry', () => ({
  agentRegistry: {
    getAll: () => [],
    get: () => undefined,
  },
}));

vi.mock('@/services/intelligence/VoiceService', () => ({
  voiceService: {
    isSupported: () => true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    startDictation: vi.fn(() => true),
    stopDictation: vi.fn(),
    stopDictationIfOwner: vi.fn(),
    isDictatingActive: () => false,
  },
}));

// Mock Framer Motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PromptArea Error Resilience', () => {
  let PromptArea: typeof PromptAreaType;
  let useTestStore: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Setup Store
    const { create } = await import('zustand');
    useTestStore = create((set: any) => ({
      currentModule: 'dashboard',
      setModule: (mod: any) => set({ currentModule: mod }),
      toggleAgentWindow: vi.fn(),
      isAgentOpen: true,
      isRightPanelOpen: true,
      toggleRightPanel: vi.fn(),
      chatChannel: 'indii', // dashboard defaults to indii
      setChatChannel: (channel: any) => set({ chatChannel: channel }),
      isCommandBarDetached: false,
      setCommandBarDetached: vi.fn(),
      commandBarInput: '',
      setCommandBarInput: (input: string) => set({ commandBarInput: input }),
      commandBarAttachments: [],
      setCommandBarAttachments: (attachments: any[]) => set({ commandBarAttachments: attachments }),
      activeAgentProvider: 'native',
      setActiveAgentProvider: vi.fn(),
      conversationMode: 'direct',
    }));

    // Mock Store Module
    vi.doMock('@/core/store', () => ({
      useStore: useTestStore,
    }));

    // Import Component
    const module = await import('./PromptArea');
    PromptArea = module.PromptArea;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores user input when message sending fails', async () => {
    // 1. Setup: Rejected Promise for sendMessage
    mockSendMessage.mockRejectedValue(new Error('Network Failure'));

    // 2. Render
    render(<PromptArea />);

    // 3. User types a prompt
    // Note: Since currentModule is dashboard -> indii mode -> label is "Ask indii"
    const input = screen.getByLabelText(/Ask indii/i);
    fireEvent.change(input, { target: { value: 'Draft a critical contract' } });

    // Verify store update
    expect(useTestStore.getState().commandBarInput).toBe('Draft a critical contract');

    // 4. User submits via Enter — send lives inside TalkButton now
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('main-prompt-input'), { key: 'Enter', shiftKey: false });
    });

    // 5. Assert: Error Toast
    expect(mockToastError).toHaveBeenCalledWith("Failed to send message.");

    // 6. Assert: Input is restored
    // The component should have re-rendered with the restored input.
    // `setCommandBarInput` is called in the catch block with `currentInput`.
    expect(useTestStore.getState().commandBarInput).toBe('Draft a critical contract');
    expect(input).toHaveValue('Draft a critical contract');

    // 7. Assert: Loading state cleared
    expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument();
    expect(screen.getByTestId('talk-button').getAttribute('data-face')).toBe('idle');
  });
});
