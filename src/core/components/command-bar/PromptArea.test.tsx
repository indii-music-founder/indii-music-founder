import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PromptArea } from './PromptArea'

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}))

vi.mock('@/services/agent/AgentService', () => ({
  agentService: {
    sendMessage: vi.fn(),
  },
}))

vi.mock('@/services/ai/VoiceService', () => ({
  voiceService: {
    isSupported: () => false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  },
}))

vi.mock('@/services/agent/registry', () => ({
  agentRegistry: {
    getAll: () => [],
  },
}))

// Use vi.hoisted to share the store reference between the mock and the test
const { storeRef } = vi.hoisted(() => ({ storeRef: { current: null as any } }))

vi.mock('@/core/store', async () => {
  const { create } = await import('zustand')

  // We define the interface to match what PromptArea uses
  const useTestStore = create((set) => ({
    currentModule: 'studio',
    setModule: (mod: any) => set({ currentModule: mod }),
    isAgentOpen: false,
    toggleAgentWindow: vi.fn(),
    chatChannel: 'agent',
    setChatChannel: (channel: any) => set({ chatChannel: channel }),
    isCommandBarDetached: false,
    setCommandBarDetached: vi.fn(),
    commandBarInput: '',
    setCommandBarInput: (input: string) => set({ commandBarInput: input }),
    commandBarAttachments: [],
    setCommandBarAttachments: (attachments: any[]) => set({ commandBarAttachments: attachments }),
  }))

  storeRef.current = useTestStore

  return {
    useStore: (selector: any) => useTestStore(selector),
  }
})

describe('PromptArea Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    if (storeRef.current) {
      storeRef.current.setState({
        commandBarInput: '',
        commandBarAttachments: [],
        chatChannel: 'agent',
        currentModule: 'studio',
        isAgentOpen: false
      })
    }
  })

  it('handles the send button interaction lifecycle', async () => {
    const user = userEvent.setup()

    // Controlled promise to simulate async operation
    let resolveMessage: (value: void | PromiseLike<void>) => void = () => { }
    const messagePromise = new Promise<void>((resolve) => {
      resolveMessage = resolve
    })

    const { agentService } = await import('@/services/agent/AgentService')
    vi.mocked(agentService.sendMessage).mockReturnValue(messagePromise)

    render(<PromptArea />)

    const runBtn = screen.getByTestId('command-bar-run-btn')
    const textarea = screen.getByRole('textbox')

    // 1. Initial State: Button disabled because input is empty
    expect(runBtn).toBeDisabled()

    // Type into the input
    await user.type(textarea, 'Hello World')

    // 2. Ready State: Button enabled
    expect(runBtn).not.toBeDisabled()
    expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument()

    // 3. Interaction: Click send
    await user.click(runBtn)

    // 4. Loading State: Button disabled and showing loader
    expect(runBtn).toBeDisabled()
    expect(screen.getByTestId('run-loader')).toBeInTheDocument()
    expect(agentService.sendMessage).toHaveBeenCalledWith('Hello World', undefined, undefined)

    // 5. Resolution: Complete the async operation
    await act(async () => {
      resolveMessage()
    })

    // 6. Final State: Input cleared, button disabled (empty input), loader gone
    await waitFor(() => {
      expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument()
    })

    // Note: PromptArea clears input on submit start, so it should be empty now
    expect(textarea).toHaveValue('')
    expect(runBtn).toBeDisabled() // Because input is empty
  })

  it('toggles the chat channel between agent and indii modes', async () => {
    const user = userEvent.setup()
    render(<PromptArea />)

    // 1. Initial State: Agent mode
    // Button should offer to switch TO indii mode
    const toggleBtn = screen.getByTestId('mode-toggle-btn')
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-label', 'Switch to indii mode')
    // Verify visual state (gray text)
    expect(toggleBtn.className).toContain('text-gray-500')

    // 2. Interaction: Click to switch to indii
    await user.click(toggleBtn)

    // 3. Feedback: Button label changes (Switch TO agent)
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute('aria-label', 'Switch to Agent mode')
    })

    // Verify visual state (purple text)
    expect(toggleBtn.className).toContain('text-purple-200')

    // 4. Interaction: Click to switch back to agent
    await user.click(toggleBtn)

    // 5. Feedback: Button label reverts
    await waitFor(() => {
      expect(toggleBtn).toHaveAttribute('aria-label', 'Switch to indii mode')
    })

    // Verify visual state (gray text)
    expect(toggleBtn.className).toContain('text-gray-500')
  })
})

