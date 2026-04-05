import { render, screen, fireEvent } from '@testing-library/react';
import { JsonViewer } from './JsonViewer';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import React from 'react';

expect.extend(matchers);

describe('JsonViewer', () => {
    const sampleData = { key: "value", number: 123 };

    it('renders with button closed by default', () => {
        render(<JsonViewer data={sampleData} />);

        // Button should be visible
        expect(screen.getByText('View Payload Data')).toBeInTheDocument();

        // Content should not be visible initially
        const pre = screen.queryByText(/"key": "value"/);
        expect(pre).not.toBeInTheDocument();
    });

    it('toggles content on click', async () => {
        render(<JsonViewer data={sampleData} />);

        const button = screen.getByRole('button'); // There is only one button
        fireEvent.click(button);

        // Should change text to "Secure Payload"
        expect(screen.getByText('Secure Payload')).toBeInTheDocument();

        // Should show content
        expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
    });

    it('has correct accessibility attributes', async () => {
        render(<JsonViewer data={sampleData} />);

        const button = screen.getByRole('button');

        expect(button).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');

        const content = screen.getByText(/"key": "value"/).closest('div'); // motion.div
        expect(content).toHaveAttribute('role', 'region');

        const contentId = content?.getAttribute('id');
        expect(contentId).toBeTruthy();
        expect(button).toHaveAttribute('aria-controls', contentId);
        expect(content).toHaveAttribute('aria-labelledby', button.getAttribute('id'));
    });

    it('passes accessibility check', async () => {
        const { container } = render(<JsonViewer data={sampleData} />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
