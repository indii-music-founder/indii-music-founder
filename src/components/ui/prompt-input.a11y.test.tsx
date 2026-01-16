import { render, screen } from '@testing-library/react'
import { PromptInput, PromptInputTextarea } from './prompt-input'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import React from 'react'
import userEvent from '@testing-library/user-event'

expect.extend(matchers)

describe('PromptInput Accessibility', () => {
  it('should have accessibility violations if textarea has no label', async () => {
    const { container } = render(
      <PromptInput>
        <PromptInputTextarea />
      </PromptInput>
    )

    const results = await axe(container)
    // We expect violations because the textarea lacks a label
    expect(results).not.toHaveNoViolations()

    // Specifically verify that one of the violations is about form field labels
    const labelViolation = results.violations.find(v => v.id === 'label')
    expect(labelViolation).toBeDefined()
  })

  it('should have no accessibility violations when aria-label is provided', async () => {
    const { container } = render(
      <PromptInput>
        <PromptInputTextarea aria-label="Chat prompt" />
      </PromptInput>
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should be focusable via keyboard', async () => {
    const user = userEvent.setup()
    render(
      <PromptInput>
        <PromptInputTextarea aria-label="Chat prompt" />
      </PromptInput>
    )

    const textarea = screen.getByRole('textbox', { name: "Chat prompt" })

    // Initial state: not focused
    expect(textarea).not.toHaveFocus()

    // Simulate Tab key to focus
    await user.tab()

    expect(textarea).toHaveFocus()
  })
})
