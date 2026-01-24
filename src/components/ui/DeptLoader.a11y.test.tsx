import { render, screen } from '@testing-library/react'
import { DeptLoader } from './DeptLoader'
import { describe, it, expect } from 'vitest'
import React from 'react'
import { axe } from 'jest-axe'

describe('DeptLoader Accessibility', () => {
    it('renders with correct accessibility attributes', async () => {
        const { container } = render(<DeptLoader message="Loading data..." />)

        // It should have role="status" and aria-live="polite"
        const loader = screen.getByRole('status')
        expect(loader).toBeInTheDocument()
        expect(loader).toHaveTextContent('Loading data...')
    })

    it('passes axe check', async () => {
        const { container } = render(<DeptLoader message="Loading data..." />)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
    })
})
