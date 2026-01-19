import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreeDCardContainer, ThreeDCard } from './ThreeDCard'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

describe('ThreeDCard Interactions', () => {
    describe('ThreeDCardContainer', () => {
        it('has button role and keyboard accessibility when onClick is provided', async () => {
            const handleClick = vi.fn()
            const user = userEvent.setup()

            render(
                <ThreeDCardContainer onClick={handleClick}>
                    <div>Click Me</div>
                </ThreeDCardContainer>
            )

            // Should be accessible as a button.
            // Note: Use getByRole which throws if not found, proving the issue.
            const button = screen.getByRole('button')

            expect(button).toBeInTheDocument()
            expect(button).toHaveAttribute('tabIndex', '0')

            // Click interaction
            await user.click(button)
            expect(handleClick).toHaveBeenCalledTimes(1)

            // Keyboard interaction (Enter)
            fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
            expect(handleClick).toHaveBeenCalledTimes(2)

            // Keyboard interaction (Space)
            fireEvent.keyDown(button, { key: ' ', code: 'Space' })
            expect(handleClick).toHaveBeenCalledTimes(3)
        })

        it('does not have button role when onClick is missing', () => {
            render(
                <ThreeDCardContainer>
                    <div>Static Card</div>
                </ThreeDCardContainer>
            )

            const button = screen.queryByRole('button')
            expect(button).not.toBeInTheDocument()
        })
    })

    describe('ThreeDCard', () => {
         it('has button role and keyboard accessibility when onClick is provided', async () => {
            const handleClick = vi.fn()
            const user = userEvent.setup()

            render(
                <ThreeDCard onClick={handleClick}>
                    <div>Click Me</div>
                </ThreeDCard>
            )

            const button = screen.getByRole('button')
            expect(button).toBeInTheDocument()
            expect(button).toHaveAttribute('tabIndex', '0')

            await user.click(button)
            expect(handleClick).toHaveBeenCalledTimes(1)

            fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
            expect(handleClick).toHaveBeenCalledTimes(2)
        })
    })
})
