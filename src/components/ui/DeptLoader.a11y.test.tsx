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
import { render, screen } from '@testing-library/react';
import { DeptLoader } from './DeptLoader';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import React from 'react';

expect.extend(matchers);

describe('DeptLoader Accessibility', () => {
    it('should have correct role and aria-live attributes', () => {
        render(<DeptLoader message="Loading content..." />);

        // We use queryByRole initially because we expect it might not be there yet before the fix
        // But for the final state, we want getByRole.
        // Since this is a test for the desired state, I will use getByRole.
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveTextContent('Loading content...');
    });

    it('should be accessible according to axe', async () => {
        const { container } = render(<DeptLoader message="Loading..." />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
