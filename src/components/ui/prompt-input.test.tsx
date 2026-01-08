import { render, screen } from '@testing-library/react'
import { PromptInput, PromptInputTextarea } from './prompt-input'
import { describe, it, expect } from 'vitest'
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
})
