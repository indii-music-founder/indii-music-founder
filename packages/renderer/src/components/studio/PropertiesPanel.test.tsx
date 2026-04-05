
import { render, screen } from '@testing-library/react';
import { PanelSection } from './PropertiesPanel';
import { describe, it, expect } from 'vitest';

describe('PanelSection', () => {
    it('renders with accessible toggle button', () => {
        render(
            <PanelSection title="Test Section">
                <p>Content</p>
            </PanelSection>
        );

        // This is expected to FAIL with the current implementation
        // because it uses a div with onClick instead of a button
        const toggleButton = screen.getByRole('button', { name: /Test Section/i });
        expect(toggleButton).toBeInTheDocument();
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders actions correctly', () => {
        render(
            <PanelSection title="Test Section" actions={<button>Action</button>}>
                <p>Content</p>
            </PanelSection>
        );

        expect(screen.getByText('Action')).toBeInTheDocument();
    });
});
