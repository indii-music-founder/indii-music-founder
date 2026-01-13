import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnnotationPalette from './AnnotationPalette';
import { STUDIO_COLORS } from '../constants';

// Mock dependencies if needed, but constants should import fine.
// If STUDIO_COLORS is complex, we might mock it, but usually it's just data.

describe('AnnotationPalette Interaction (🖱️ Click)', () => {
    const mockOnColorSelect = vi.fn();
    const mockOnOpenDefinitions = vi.fn();
    const mockDefinitions = {
        'nc-1': 'Context Definition', // Assuming IDs like nc-1 based on typical strings
    };

    // We'll use the first real color for testing to ensure integration is correct
    const firstColor = STUDIO_COLORS[0];
    const secondColor = STUDIO_COLORS[1];

    it('verifies the Color Selection lifecycle (Click → Active State)', () => {
        const { rerender } = render(
            <AnnotationPalette
                activeColor={firstColor}
                onColorSelect={mockOnColorSelect}
                colorDefinitions={mockDefinitions}
                onOpenDefinitions={mockOnOpenDefinitions}
            />
        );

        // 1. Ready State: Colors are rendered
        const colorBtn1 = screen.getByTestId(`color-btn-${firstColor.id}`);
        const colorBtn2 = screen.getByTestId(`color-btn-${secondColor.id}`);

        // Verify active styling loosely (checking class logic is brittle in unit tests, 
        // but checking the prop passed back is robust)

        // 2. Action: Click second color
        fireEvent.click(colorBtn2);

        // 3. Feedback: Callback fired
        expect(mockOnColorSelect).toHaveBeenCalledWith(secondColor);

        // Re-render with new active color to simulate parent state update
        rerender(
            <AnnotationPalette
                activeColor={secondColor}
                onColorSelect={mockOnColorSelect}
                colorDefinitions={mockDefinitions}
                onOpenDefinitions={mockOnOpenDefinitions}
            />
        );

        // Assert visual state (optional, but good for "Click" persona)
        // Accessing the element again to check if styles update properly 
        // (usually checking for the "ring" class or similar unique active marker)
        // The component uses `ring-2` for active.
        expect(colorBtn2).toHaveClass('ring-2');
    });

    it('verifies the Settings/Definitions toggle lifecycle', () => {
        render(
            <AnnotationPalette
                activeColor={firstColor}
                onColorSelect={mockOnColorSelect}
                colorDefinitions={mockDefinitions}
                onOpenDefinitions={mockOnOpenDefinitions}
            />
        );

        const settingsBtn = screen.getByTestId('palette-settings-btn');

        // Action: Click Settings
        fireEvent.click(settingsBtn);

        // Feedback: Open callback fired
        expect(mockOnOpenDefinitions).toHaveBeenCalled();
    });
});
