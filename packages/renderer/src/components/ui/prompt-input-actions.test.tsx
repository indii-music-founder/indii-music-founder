import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptInput, PromptInputActions, PromptInputAction, PromptInputTextarea } from './prompt-input'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('PromptInput Interaction', () => {
  it('lets a caller consume Enter before the shared submit action', () => {
    const onSubmit = vi.fn()
    render(<PromptInput onSubmit={onSubmit}>
      <PromptInputTextarea onKeyDown={event => event.preventDefault()} />
    </PromptInput>)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('preserves native Enter behavior when there is no submit callback', () => {
    render(<PromptInput><PromptInputTextarea /></PromptInput>)
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })).toBe(true)
  })

  it('updates shared prompt state alongside a textarea change listener', () => {
    const onValueChange = vi.fn()
    const onChange = vi.fn()
    render(<PromptInput onValueChange={onValueChange}>
      <PromptInputTextarea onChange={onChange} />
    </PromptInput>)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'A draft worth keeping' } })
    expect(input).toHaveValue('A draft worth keeping')
    expect(onValueChange).toHaveBeenCalledWith('A draft worth keeping')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('keeps loading prompts disabled even when a child requests enabled input', () => {
    render(<PromptInput isLoading><PromptInputTextarea disabled={false} /></PromptInput>)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('waits for IME composition to finish before submitting Enter', () => {
    const onSubmit = vi.fn()
    render(<PromptInput onSubmit={onSubmit}><PromptInputTextarea /></PromptInput>)
    const input = screen.getByTestId('prompt-input')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledOnce()
  })

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
    expect(sendBtn).toBeDisabled()

    // 5. Verify the UI returns to a "ready" state
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
          <PromptInputAction tooltip={tooltipText}>
            <button aria-label={existingLabel} data-testid="send-btn-explicit-2">
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
