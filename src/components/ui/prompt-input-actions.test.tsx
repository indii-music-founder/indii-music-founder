import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptInput, PromptInputActions, PromptInputAction, PromptInputTextarea } from './prompt-input'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('PromptInput Interaction', () => {
  it('PromptInputAction handles click interaction and disables state', async () => {
    const user = userEvent.setup()
    const onActionClick = vi.fn()

    const TestComponent = ({ isLoading = false }: { isLoading?: boolean }) => (
      <PromptInput isLoading={isLoading}>
        <PromptInputTextarea />
        <PromptInputActions>
          <PromptInputAction tooltip="Send Message">
            <button
              data-testid="send-btn"
              onClick={onActionClick}
              type="button"
            >
              Send
            </button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const { rerender } = render(<TestComponent isLoading={false} />)

    const sendBtn = screen.getByTestId('send-btn')

    // 1. Assert ready state
    expect(sendBtn).not.toBeDisabled()

    // 2. Simulate click
    await user.click(sendBtn)
    expect(onActionClick).toHaveBeenCalledTimes(1)

    // 3. Re-render with isLoading=true (Simulation of state change after click)
    rerender(<TestComponent isLoading={true} />)

    // 4. Assert disabled state
    // PromptInput passes disabled=true via context to PromptInputAction
    // PromptInputAction passes disabled=true to TooltipTrigger
    // TooltipTrigger (asChild) passes disabled=true to the button
    expect(sendBtn).toBeDisabled()

    // 5. Try to click again
    // userEvent.click respects disabled attribute and should not trigger onClick.
    // However, it might throw if pointer-events: none is applied.
    // If we just want to ensure it's disabled, the above assertion is good.
    // But let's try to force a click (or check that userEvent ignores it).
    // To be safe and avoid test errors on "unable to click", we can use fireEvent or try/catch user.click,
    // or just rely on .toBeDisabled().
    // But Click's philosophy: "A button that doesn't react is a broken button" -> well, here it SHOULD NOT react.
    // "Verify the UI returns to a "ready" state after the action completes" -> we can test going back to isLoading=false.

    // Let's verify it goes back to ready.
    rerender(<TestComponent isLoading={false} />)
    expect(sendBtn).not.toBeDisabled()

    await user.click(sendBtn)
    expect(onActionClick).toHaveBeenCalledTimes(2)
  })

  it('automatically uses tooltip as aria-label for the trigger button if aria-label is missing', () => {
    const tooltipText = "Send Message"

    render(
      <PromptInput>
        <PromptInputTextarea />
        <PromptInputActions>
          <PromptInputAction tooltip={tooltipText}>
            <button data-testid="send-btn">
              Icon
            </button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const sendBtn = screen.getByTestId('send-btn')

    // This is what we want to achieve.
    expect(sendBtn).toHaveAttribute('aria-label', tooltipText)
  })

  it('respects existing aria-label', () => {
    const tooltipText = "Send Message"
    const existingLabel = "Submit Prompt"

    render(
      <PromptInput>
        <PromptInputTextarea />
        <PromptInputActions>
          <PromptInputAction tooltip={tooltipText}>
            <button aria-label={existingLabel} data-testid="send-btn-explicit">
              Icon
            </button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const sendBtn = screen.getByTestId('send-btn-explicit')

    // Should keep the explicit label
    expect(sendBtn).toHaveAttribute('aria-label', existingLabel)
  })

  it('PromptInputAction applies tooltip as aria-label to child button', () => {
    render(
      <PromptInput>
        <PromptInputTextarea />
        <PromptInputActions>
          <PromptInputAction tooltip="Run command">
            <button data-testid="icon-only-btn">Icon</button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const btn = screen.getByTestId('icon-only-btn')
    expect(btn).toHaveAttribute('aria-label', 'Run command')
  })
})
