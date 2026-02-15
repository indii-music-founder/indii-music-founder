import { render, screen } from '@testing-library/react'
import { PromptInput, PromptInputActions, PromptInputAction, PromptInputTextarea } from './prompt-input'
import { describe, it, expect } from 'vitest'
import React from 'react'

describe('PromptInputAction Accessibility Auto-Label', () => {
  it('should automatically apply aria-label from tooltip string', () => {
    render(
      <PromptInput>
        <PromptInputTextarea />
        <PromptInputActions>
            <PromptInputAction tooltip="Upload File">
                <button data-testid="upload-btn">
                    <svg />
                </button>
            </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    )

    const btn = screen.getByTestId('upload-btn')

    // After fix: expected to be "Upload File"
    const label = btn.getAttribute('aria-label')
    expect(label).toBe('Upload File')
  })
})
