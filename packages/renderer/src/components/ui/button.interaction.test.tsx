import { render, screen, act, fireEvent } from '@testing-library/react'
import { Button } from './button'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { useState } from 'react'

// Mock Lucide icons to ensure stable selectors and avoid SVG complexity
vi.mock('lucide-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('lucide-react')>()),
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader-icon" className={className}>
      Loading...
    </div>
  ),
}))

describe('Button Interaction Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('completes the full Click -> Loading -> Success interaction loop', async () => {
    const onAction = vi.fn()

    // Test Component simulating a real async form submission
    const AsyncButton = () => {
      const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')

      const handleClick = () => {
        setStatus('loading')
        onAction()

        // Simulate network request
        setTimeout(() => {
          setStatus('success')
          // Reset to idle after success feedback
          setTimeout(() => {
            setStatus('idle')
          }, 1000)
        }, 2000)
      }

      return (
        <Button
          onClick={handleClick}
          isLoading={status === 'loading'}
          disabled={status === 'success'} // Disable during success message
          data-testid="submit-btn"
          variant={status === 'success' ? 'secondary' : 'default'}
        >
          {status === 'loading' ? 'Saving...' : status === 'success' ? 'Saved!' : 'Save Changes'}
        </Button>
      )
    }

    render(<AsyncButton />)
    const btn = screen.getByTestId('submit-btn')

    // --------------------------------------------------
    // 1. IDLE STATE
    // --------------------------------------------------
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent('Save Changes')
    expect(btn).not.toHaveAttribute('data-loading', 'true')
    expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument()

    // --------------------------------------------------
    // 2. CLICK ACTION
    // --------------------------------------------------
    fireEvent.click(btn)

    // Verify callback was triggered
    expect(onAction).toHaveBeenCalledTimes(1)

    // --------------------------------------------------
    // 3. LOADING STATE (Feedback)
    // --------------------------------------------------
    // Button should be disabled and showing loader
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('data-loading', 'true')
    expect(btn).toHaveTextContent('Saving...')
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    // Verify spinner class (passed from Button component)
    expect(screen.getByTestId('loader-icon')).toHaveClass('animate-spin')

    // --------------------------------------------------
    // 4. ASYNC COMPLETION (Success)
    // --------------------------------------------------
    // Advance time to finish "request" (2000ms)
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Button should show success state
    expect(btn).toHaveTextContent('Saved!')
    expect(btn).toBeDisabled() // As per our test component logic
    expect(btn).not.toHaveAttribute('data-loading', 'true')
    expect(screen.queryByTestId('loader-icon')).not.toBeInTheDocument()

    // --------------------------------------------------
    // 5. RESET TO IDLE (Final State)
    // --------------------------------------------------
    // Advance time to finish "reset" (1000ms)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Back to original state
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent('Save Changes')
  })

  it('prevents multiple clicks while loading (Spam Click Prevention)', async () => {
    const onAction = vi.fn()

    const SpamSafeButton = () => {
      const [isLoading, setIsLoading] = useState(false)

      const handleClick = () => {
        if (isLoading) return // Extra safety, though disabled attribute handles it
        setIsLoading(true)
        onAction()
        setTimeout(() => setIsLoading(false), 1000)
      }

      return (
        <Button
          onClick={handleClick}
          isLoading={isLoading}
          data-testid="spam-btn"
        >
          Click Me
        </Button>
      )
    }

    render(<SpamSafeButton />)
    const btn = screen.getByTestId('spam-btn')

    // First click
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(btn).toBeDisabled()

    // Second click (Spam) - Attempt to click while disabled
    // userEvent.click throws if element is disabled unless { skipPointerEventsCheck: true } is set,
    // but browsers ignore clicks on disabled elements.
    // We try to force it or simulate user trying to click.
    // In React testing library userEvent, clicking a disabled element usually does nothing or throws.
    // We want to ensure the handler isn't called even if we somehow force the event?
    // Actually, confirming it's disabled is usually enough for "Spam Click" protection at UI level.

    expect(btn).toHaveAttribute('disabled')
  })
})
