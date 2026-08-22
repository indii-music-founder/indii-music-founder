import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const dictationHandlers: Array<{
  onFinal?: (t: string) => void;
  onInterim?: (t: string) => void;
  onEnd?: () => void;
  onError?: (e: unknown) => void;
}> = [];

vi.mock('@/services/intelligence/VoiceService', () => ({
  voiceService: {
    isSupported: () => true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    startDictation: vi.fn((handlers: (typeof dictationHandlers)[number]) => {
      dictationHandlers.push(handlers);
      return true;
    }),
    stopDictation: vi.fn(),
  },
}));

// Mock motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
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
  isCommandBarCollapsed: false,
  setCommandBarCollapsed: vi.fn(),
  commandBarPosition: 'center' as const,
  setCommandBarPosition: vi.fn(),
  commandBarInput: 'test command',
  setCommandBarInput: vi.fn(),
  commandBarAttachments: [] as any[],
  setCommandBarAttachments: vi.fn(),
  activeAgentProvider: undefined as string | undefined,
  setActiveAgentProvider: vi.fn(),
  isRightPanelOpen: false,
  toggleRightPanel: vi.fn(),
  isKnowledgeBaseEnabled: false,
  setKnowledgeBaseEnabled: vi.fn(),
  agentMode: 'assistant',
  isAgentProcessing: false,
  rightPanelTab: 'agent',
  rightPanelView: 'messages',
}));

vi.mock('@/core/store', () => ({
  useStore: Object.assign(
    (selector: any) => selector(storeState),
    {
      getState: () => storeState,
      setState: (partial: any) => Object.assign(storeState, typeof partial === 'function' ? partial(storeState) : partial),
      subscribe: vi.fn(),
    }
  ),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}));

import { PromptArea } from './PromptArea';

describe('PromptArea State Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dictationHandlers.length = 0;
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

    // Verify initial state: talkback button idle, stop face absent
    const talkBtn = screen.getByTestId('talk-button');
    expect(talkBtn).not.toBeDisabled();
    expect(talkBtn.getAttribute('data-face')).toBe('idle');
    expect(screen.queryByTestId('command-bar-stop-btn')).not.toBeInTheDocument();

    // Submit via Enter on the textarea — send lives inside TalkButton now
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('main-prompt-input'), { key: 'Enter', shiftKey: false });
      // Allow microtask to flush for setIsProcessing(true)
      await new Promise(r => setTimeout(r, 0));
    });

    // When processing: TalkButton shows its stop face
    expect(screen.getByTestId('command-bar-stop-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('talk-button')).not.toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      resolveMessage!();
    });

    // After completion: stop face gone, input cleared via store
    expect(screen.queryByTestId('command-bar-stop-btn')).not.toBeInTheDocument();
    expect(storeState.setCommandBarInput).toHaveBeenCalledWith(''); // Input cleared via store
  });

  it('talkback release auto-sends the dictated take without touching the mouse twice', async () => {
    storeState.commandBarInput = ''; // clean slate
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    render(<PromptArea />);

    // Open the talkback channel
    fireEvent.click(screen.getByTestId('talk-button'));
    expect(dictationHandlers).toHaveLength(1);
    const handlers = dictationHandlers[0]!;

    // The user speaks; interim words stream into the input
    await act(async () => {
      handlers.onInterim!('book me a studio');
    });
    expect(storeState.setCommandBarInput).toHaveBeenLastCalledWith('book me a studio');

    // Release past the jitter window: stop + send in one click
    vi.setSystemTime(1_000_500);
    await act(async () => {
      fireEvent.click(screen.getByTestId('talk-button'));
      await vi.runAllTimersAsync();
    });

    expect(mockSendMessage).toHaveBeenCalledWith(
      'book me a studio',
      undefined,
      undefined,
    );
    vi.useRealTimers();
  });

  it('typing during a live talkback disarms auto-send: release keeps the text', async () => {
    storeState.commandBarInput = ''; // clean slate
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);

    render(<PromptArea />);
    fireEvent.click(screen.getByTestId('talk-button'));
    const handlers = dictationHandlers[0]!;

    await act(async () => {
      handlers.onFinal!('draft take');
    });

    // User types over the draft — a real change event disarms the auto-send
    fireEvent.change(screen.getByTestId('main-prompt-input'), { target: { value: 'draft take (edited)' } });

    // Release past the jitter window, but auto-send is disarmed
    vi.setSystemTime(2_000_600);
    await act(async () => {
      fireEvent.click(screen.getByTestId('talk-button'));
      await vi.runAllTimersAsync();
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
    // Text survives for a deliberate send (release rewrites the final take)
    const lastCall = storeState.setCommandBarInput.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('draft take');
    vi.useRealTimers();
  });
});
