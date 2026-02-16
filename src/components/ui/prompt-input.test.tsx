import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptInput, PromptInputTextarea } from './prompt-input'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('PromptInput', () => {
  it('renders with focus-within classes', () => {
    render(
      <PromptInput>
        <PromptInputTextarea />
      </PromptInput>
    )

    const container = screen.getByTestId('prompt-input')
    expect(container).toHaveClass('focus-within:ring-2')
    expect(container).toHaveClass('focus-within:ring-ring')
    expect(container).toHaveClass('focus-within:ring-offset-2')
  })

  it('updates value when typing', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <PromptInput onValueChange={onValueChange}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello World')

    expect(textarea).toHaveValue('Hello World')
    expect(onValueChange).toHaveBeenLastCalledWith('Hello World')
  })

  it('submits on Enter (without Shift)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}World')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Hello\nWorld')
  })

  it('disables input when isLoading is true', () => {
    render(
      <PromptInput isLoading={true}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const container = screen.getByTestId('prompt-input')
    const textarea = screen.getByRole('textbox')

    expect(container).toHaveClass('opacity-60')
    expect(container).toHaveClass('cursor-not-allowed')
    expect(textarea).toBeDisabled()
  })

  it('does not submit when disabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <PromptInput disabled={true} onSubmit={onSubmit}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox')
    // We can't type into a disabled input with userEvent, so we check it's disabled
    // and try to force a keydown event using fireEvent to ensure the handler blocks it or simply rely on the disabled attribute

    expect(textarea).toBeDisabled()

    // Attempt to manually fire the event, though browsers would block this on disabled inputs.
    // The handler logic usually sits on the element.
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit when isLoading is true', async () => {
    const onSubmit = vi.fn()

    render(
      <PromptInput isLoading={true} onSubmit={onSubmit}>
        <PromptInputTextarea />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
