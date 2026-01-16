import { render, screen, fireEvent } from '@testing-library/react'
import { ThreeDButton } from './ThreeDButton'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('ThreeDButton', () => {
  it('renders correctly with default props', () => {
    render(<ThreeDButton>Click Me</ThreeDButton>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    // Default variant is primary
    expect(button).toHaveClass('bg-white')
  })

  it('applies variant classes correctly', () => {
    const { rerender } = render(<ThreeDButton variant="danger">Danger</ThreeDButton>)

    let button = screen.getByRole('button', { name: /danger/i })
    expect(button).toHaveClass('bg-red-500')
    expect(button).toHaveClass('border-red-700')

    rerender(<ThreeDButton variant="secondary">Secondary</ThreeDButton>)
    button = screen.getByRole('button', { name: /secondary/i })
    expect(button).toHaveClass('bg-gray-800')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<ThreeDButton onClick={handleClick} data-testid="3d-btn">Click Me</ThreeDButton>)

    const button = screen.getByTestId('3d-btn')
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and prevents clicks when disabled prop is true', () => {
    const handleClick = vi.fn()
    render(<ThreeDButton disabled onClick={handleClick} data-testid="3d-btn-disabled">Disabled</ThreeDButton>)

    const button = screen.getByTestId('3d-btn-disabled')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveClass('opacity-50')
    expect(button).toHaveClass('cursor-not-allowed')

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows loader and prevents clicks when isLoading is true', () => {
    const handleClick = vi.fn()
    render(<ThreeDButton isLoading onClick={handleClick} data-testid="3d-btn-loading">Processing</ThreeDButton>)

    const button = screen.getByTestId('3d-btn-loading')
    expect(button).toBeDisabled()

    // Check for spinner (Loader2 from lucide-react usually renders an svg)
    // We can check for the "animate-spin" class on the child
    const spinner = button.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('removes 3D press effect classes when disabled', () => {
    render(<ThreeDButton disabled data-testid="3d-btn-no-motion">No Motion</ThreeDButton>)

    const button = screen.getByTestId('3d-btn-no-motion')
    // The component applies 'active:translate-y-0' when disabled to cancel the effect
    expect(button).toHaveClass('active:translate-y-0')
    expect(button).toHaveClass('active:border-b-4')
  })
})
