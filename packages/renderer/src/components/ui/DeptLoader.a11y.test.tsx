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
