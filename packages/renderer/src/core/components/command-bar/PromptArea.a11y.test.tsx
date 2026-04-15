import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptArea } from './PromptArea';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('@/services/agent/AgentService', () => ({
  agentService: { sendMessage: vi.fn() },
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

// Mock store
const mockSetCommandBarInput = vi.fn();
const mockSetCommandBarAttachments = vi.fn();
const mockSetModule = vi.fn();
const mockToggleAgentWindow = vi.fn();
const mockSetChatChannel = vi.fn();
const mockSetCommandBarDetached = vi.fn();

vi.mock('@/core/store', () => ({
  useStore: () => ({
    currentModule: 'dashboard',
    setModule: mockSetModule,
    toggleAgentWindow: mockToggleAgentWindow,
    isAgentOpen: false,
    chatChannel: 'agent',
    setChatChannel: mockSetChatChannel,
    isCommandBarDetached: false,
    setCommandBarDetached: mockSetCommandBarDetached,
    commandBarInput: '',
    setCommandBarInput: mockSetCommandBarInput,
    commandBarAttachments: [],
    setCommandBarAttachments: mockSetCommandBarAttachments,
  }),
}));

// Mock motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock prompt-input components to avoid context issues or simplify structure?
// Actually, we want to test the real rendering, so let's keep them if possible.
// But we need to ensure they work. PromptInput uses context. It should be fine.

describe('PromptArea Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    window.dispatchEvent(new Event('resize'));
  });

  it('renders all action buttons with focus-visible styles', () => {
    render(<PromptArea />);

    // Select buttons
    // Note: PromptInputAction applies the tooltip text as aria-label to the child button

    // 1. Attach Button
    const attachBtn = screen.getByRole('button', { name: /attach files/i });
    expect(attachBtn).toBeInTheDocument();

    // 2. Dictate Button
    const dictateBtn = screen.getByRole('button', { name: /voice input/i });
    expect(dictateBtn).toBeInTheDocument();

    // 3. Agent / indii mode toggle button
    // The PromptArea refactor replaced the agent-selector dropdown with a
    // mode-toggle button whose aria-label is either "Switch to Agent mode" or
    // "Switch to indii mode" depending on whether indii mode is active.
    // Our mock has chatChannel='agent' (not 'indii'), so isIndiiMode=false,
    // meaning the button reads "Switch to indii mode".
    const modeToggleBtn = screen.getByRole('button', { name: /switch to (agent|indii) mode/i });
    expect(modeToggleBtn).toBeInTheDocument();

    // 4. Dock/Detach Button (only shown when !isDocked && !isMobile && !isBoardroomMode)
    // Our mock: currentModule='dashboard' (not boardroom), isCommandBarDetached=false → "Detach from Agent"
    const dockBtn = screen.getByRole('button', { name: /detach from agent/i });
    expect(dockBtn).toBeInTheDocument();

    // 5. Send/Run Button — aria-label is "Run command" (tooltip is "Send Message (Enter)")
    const runBtn = screen.getByRole('button', { name: /run command/i });
    expect(runBtn).toBeInTheDocument();

    // Check for focus-visible classes
    // Expected classes: focus-visible:ring-2
    // We expect these to be MISSING initially.

    const buttonsToCheck = [attachBtn, dictateBtn, dockBtn, modeToggleBtn, runBtn];

    // We assert that they DO NOT have the classes yet (to confirm reproduction of "issue")
    // Or we can just try to assert they DO have them and let it fail.
    // The plan says "check for the presence... which are currently missing".

    // Let's check for the existence of 'focus-visible:ring-2'.
    // Using simple class check string inclusion.

    buttonsToCheck.forEach(btn => {
       // Ideally we want this to pass AFTER the fix.
       // For now, I'll write the expectation for the FIX, and expect the test to FAIL.
       // Or I can comment it out?
       // No, I'll write the test to verify the fix.
       expect(btn.className).toContain('focus-visible:ring-2');
       expect(btn.className).toContain('focus-visible:ring-ring');
    });

    // Also check the delegate button (left side)
    // It's the one that opens the menu.
    // We can find it via the chevron icon or just by index if we are careful.
    // <button onClick={() => setOpenDelegate(!openDelegate)} ...>
    // It is rendered conditionally !isMobile. We assume desktop environment (default for JSDOM).
  });

  it('renders textarea with accessible name', () => {
    render(<PromptArea />);
    // Based on mock: currentModule='dashboard', isIndiiMode=false (initially)
    // Label should be "Message dashboard"
    const textarea = screen.getByRole('textbox', { name: /message dashboard/i });
    expect(textarea).toBeInTheDocument();
  });
});
