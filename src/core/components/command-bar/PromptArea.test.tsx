import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';

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

// Real store for testing to support useShallow
const useTestStore = create((set) => ({
  currentModule: 'dashboard',
  setModule: (mod: any) => set({ currentModule: mod }),
  toggleAgentWindow: vi.fn(),
  isAgentOpen: false,
  chatChannel: 'agent',
  setChatChannel: (channel: any) => set({ chatChannel: channel }),
  isCommandBarDetached: false,
  setCommandBarDetached: vi.fn(),
  commandBarInput: 'test command', // Initial value to enable button
  setCommandBarInput: (input: string) => set({ commandBarInput: input }),
  commandBarAttachments: [],
  setCommandBarAttachments: (attachments: any[]) => set({ commandBarAttachments: attachments }),
}));

// We need to define the mock *before* importing PromptArea because vi.mock is hoisted
// but the variable useTestStore is not available inside the factory if it's defined in the same scope.
// However, since `useTestStore` is defined in the top level scope, we can use `vi.doMock`
// OR better yet, define the mock inside the factory or use `vi.hoisted`.

// Correct approach using a simple mock that delegates to the test store
// But we can't reference useTestStore in the hoisted mock.
// So we mock the module to return a store that we can manipulate.

// Let's refactor to avoid the ReferenceError.
vi.mock('@/core/store', () => {
  // We can't use useTestStore here directly.
  // We need to create the store inside the mock or use a global mechanism.
  // BUT, to keep it simple and effective with Vitest:

  // We will defer the import of PromptArea until AFTER the mocks are set up? No, imports are hoisted.

  // The issue is `useTestStore` is declared with `const` and TDZ applies.
  // Let's use `vi.hoisted` to create the store? No, `zustand` might not be available there.

  return {
    useStore: (selector: any) => {
      // This is a dynamic proxy to the store we define below
      // This relies on the fact that when `useStore` is called (at render time),
      // `useTestStore` will be initialized.
      return useTestStore(selector);
    }
  };
});

// Import PromptArea AFTER the mocks (imports are hoisted but execution order matters for the `vi.mock` factory?)
// Actually `vi.mock` is hoisted to the top. `useTestStore` is defined later.
// The factory function inside `vi.mock` runs before `useTestStore` is initialized.
// So `useTestStore` is undefined when the mock factory runs?
// No, the mock factory runs when `@/core/store` is imported by PromptArea.
// PromptArea is imported at the top level.
// So the sequence is:
// 1. vi.mock declarations are hoisted and registered.
// 2. Import PromptArea -> triggers import '@/core/store' -> executes mock factory.
// 3. Mock factory tries to access `useTestStore` -> Error (TDZ).

// FIX: Move `useTestStore` definition into a separate module or use a mutable object that is hoisted.
// Or just define the store inline in the mock, but we need access to it in tests.

// Alternative: Use `vi.doMock` and dynamic imports for PromptArea inside `beforeEach`?
// That's cleaner for isolation but harder to setup with Typescript sometimes.

// Easiest fix: use a mutable global/singleton pattern for the store state that we can access.
// OR, mock the hook to just return state directly without a real store, BUT `PromptArea` uses `useShallow`.
// `useShallow` expects the selector to be called with state.

// Let's try `vi.doMock` approach.
// We need to remove the static import of PromptArea.

import type { PromptArea as PromptAreaType } from './PromptArea';

describe('PromptArea State Feedback', () => {
  let PromptArea: typeof PromptAreaType;
  let useTestStore: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Re-setup dependencies mocks because resetModules clears them?
    // No, vi.mock is persistent unless we clear them.
    // But we need to redefine the store mock for each test or once globally.

    // Let's define the store first.
    const { create } = await import('zustand');
    useTestStore = create((set) => ({
      currentModule: 'dashboard',
      setModule: (mod: any) => set({ currentModule: mod }),
      toggleAgentWindow: vi.fn(),
      isAgentOpen: false,
      chatChannel: 'agent',
      setChatChannel: (channel: any) => set({ chatChannel: channel }),
      isCommandBarDetached: false,
      setCommandBarDetached: vi.fn(),
      commandBarInput: 'test command',
      setCommandBarInput: (input: string) => set({ commandBarInput: input }),
      commandBarAttachments: [],
      setCommandBarAttachments: (attachments: any[]) => set({ commandBarAttachments: attachments }),
    }));

    // Mock the store module
    vi.doMock('@/core/store', () => ({
      useStore: useTestStore,
    }));

    // Mock other dependencies again just to be safe with doMock if needed,
    // but top-level vi.mock should stick if we didn't reset everything?
    // vi.resetModules() clears the module registry cache.
    // So we need to re-import PromptArea.

    // We also need to ensure the other mocks are still active.
    // Top level vi.mock works with vitest even with resetModules usually,
    // but let's re-verify.
    // Actually, `vi.mock` is hoisted, so it applies globally.
    // `vi.doMock` overrides for the next import.

    // Import the component under test
    const module = await import('./PromptArea');
    PromptArea = module.PromptArea;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      resolveMessage();
    });

    // Verify success state: Loader gone, input cleared
    expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument();
    expect(runBtn).toBeDisabled(); // Disabled because input is cleared
  });
});
