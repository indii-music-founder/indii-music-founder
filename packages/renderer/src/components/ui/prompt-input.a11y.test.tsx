import { render, screen } from '@testing-library/react'
import { PromptInput, PromptInputTextarea, PromptInputAction, PromptInputActions } from './prompt-input'
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

  it('PromptInputAction should apply tooltip text as aria-label to the trigger', async () => {
    render(
      <PromptInput>
        <PromptInputActions>
          <PromptInputAction tooltip="Generate Video">
             <button>Icon</button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    // Should find the button by its accessible name (which comes from the tooltip)
    const button = screen.getByRole('button', { name: "Generate Video" })
    expect(button).toBeInTheDocument()
  })

  it('PromptInputAction should not override existing aria-label', async () => {
    render(
      <PromptInput>
        <PromptInputActions>
          <PromptInputAction tooltip="Tooltip Text">
             <button aria-label="Explicit Label">Icon</button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const button = screen.getByRole('button', { name: "Explicit Label" })
    expect(button).toBeInTheDocument()

    // Ensure it's NOT found by the tooltip text if we look for accessible name
    const buttonByTooltip = screen.queryByRole('button', { name: "Tooltip Text" })
    expect(buttonByTooltip).not.toBeInTheDocument()
  })
})
