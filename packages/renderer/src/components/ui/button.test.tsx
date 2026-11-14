import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('Button Interaction', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click Me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    expect(button).toHaveClass('bg-primary')
    expect(button).toHaveClass('text-primary-foreground')
  })

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>)

    let button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('text-destructive-foreground')

    rerender(<Button variant="outline">Cancel</Button>)
    button = screen.getByRole('button', { name: /cancel/i })
    expect(button).toHaveClass('border-input')
    expect(button).toHaveClass('bg-background')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} data-testid="action-btn">Action</Button>)

    const button = screen.getByTestId('action-btn')
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled and prevents clicks when disabled prop is true', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick} data-testid="disabled-btn">Disabled</Button>)

    const button = screen.getByTestId('disabled-btn')
    expect(button).toBeDisabled()
    // The component sets aria-disabled
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveClass('disabled:opacity-50')
    expect(button).toHaveClass('disabled:pointer-events-none')

    // Attempt to click
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('shows loader and prevents clicks when isLoading is true', () => {
    const handleClick = vi.fn()
    render(<Button isLoading onClick={handleClick} data-testid="loading-btn">Processing</Button>)

    const button = screen.getByTestId('loading-btn')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-loading', 'true')

    // Check for spinner (Loader2 from lucide-react)
    // We look for the class 'animate-spin' which Loader2 should have
    const spinner = button.querySelector('svg[aria-hidden=true]')
    expect(spinner).toBeInTheDocument()

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders as a child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/link">Link Button</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/link')
    expect(link).toHaveClass('bg-primary') // Inherits button styles
  })

  it.each(['disabled', 'loading'] as const)('blocks the child anchor and both click handlers while %s', state => {
    const parentClick = vi.fn()
    const childClick = vi.fn()
    const childCapture = vi.fn()
    const buttonRef = React.createRef<HTMLButtonElement>()
    const childRef = React.createRef<HTMLAnchorElement>()
    render(
      <Button asChild ref={buttonRef} disabled={state === 'disabled'} isLoading={state === 'loading'} onClick={parentClick}>
        <a ref={childRef} href="/checkout" onClick={childClick} onClickCapture={childCapture}>Checkout</a>
      </Button>
    )
    const anchor = screen.getByText('Checkout')
    expect(buttonRef.current).toBe(anchor)
    expect(childRef.current).toBe(anchor)
    expect(anchor).not.toHaveAttribute('href')
    expect(anchor).toHaveAttribute('aria-disabled', 'true')
    expect(anchor).toHaveAttribute('tabindex', '-1')
    fireEvent.click(anchor)
    fireEvent.keyDown(anchor, { key: 'Enter' })
    expect(parentClick).not.toHaveBeenCalled()
    expect(childClick).not.toHaveBeenCalled()
    expect(childCapture).not.toHaveBeenCalled()
  })
})

it('announces a loading native button as disabled despite a forwarded ARIA value', () => {
    render(<Button isLoading aria-disabled={false}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
});
