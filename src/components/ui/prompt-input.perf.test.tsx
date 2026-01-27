import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptInput, PromptInputTextarea, PromptInputAction } from './prompt-input'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { PropsWithChildren } from 'react'

// Mock the Tooltip components to track re-renders
const TooltipSpy = vi.fn(({ children }: PropsWithChildren) => <>{children}</>)

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: (props: PropsWithChildren) => TooltipSpy(props),
  TooltipTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: PropsWithChildren) => <>{children}</>,
}))

describe('PromptInput Performance', () => {
  beforeEach(() => {
    TooltipSpy.mockClear()
  })

  it('PromptInputAction should NOT re-render when typing in PromptInputTextarea', async () => {
    const user = userEvent.setup()

    render(
      <PromptInput>
        <PromptInputTextarea />
        <PromptInputAction tooltip="Test Action">
          <button>Action</button>
        </PromptInputAction>
      </PromptInput>
    )

    // Initial render
    // PromptInputAction renders Tooltip once
    expect(TooltipSpy).toHaveBeenCalledTimes(1)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'A')

    // After typing 'A':
    // With optimization: TooltipSpy should still be 1 (PromptInputAction didn't re-render)
    expect(TooltipSpy).toHaveBeenCalledTimes(1)
  })
})
