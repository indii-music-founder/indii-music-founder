import { render, screen, fireEvent } from '@testing-library/react'
import { Slider } from './slider'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import React from 'react'
import userEvent from '@testing-library/user-event'

expect.extend(matchers)

describe('Slider Accessibility', () => {
  it('should have accessibility violations if slider has no label', async () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} step={1} />)

    const results = await axe(container)
    expect(results).not.toHaveNoViolations()

    // Specifically verify that one of the violations is about form field labels
    const labelViolation = results.violations.find(v => v.id === 'label' || v.id === 'form-field-name')
    expect(labelViolation).toBeDefined()
  })

  it('should have no accessibility violations when aria-label is provided', async () => {
    const { container } = render(<Slider aria-label="Volume" defaultValue={[50]} />)

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should be focusable via keyboard', async () => {
    const user = userEvent.setup()

    render(
      <Slider
        aria-label="Volume"
        defaultValue={[50]}
        max={100}
        step={10}
      />
    )

    const slider = screen.getByRole('slider')

    // Initial state: not focused
    expect(slider).not.toHaveFocus()

    // Simulate Tab key to focus
    await user.tab()
    expect(slider).toHaveFocus()
  })

  it('should trigger onValueChange when value changes', () => {
    const handleValueChange = vi.fn()

    render(
      <Slider
        aria-label="Volume"
        defaultValue={[50]}
        max={100}
        step={10}
        onValueChange={handleValueChange}
      />
    )

    const slider = screen.getByRole('slider')

    // Simulate value change (as JSDOM doesn't support arrow keys for range inputs natively)
    fireEvent.change(slider, { target: { value: '60' } })

    expect(handleValueChange).toHaveBeenLastCalledWith([60])
    expect(slider).toHaveValue('60')
  })
})
