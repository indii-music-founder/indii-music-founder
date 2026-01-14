import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScoutControls } from './ScoutControls';

describe('ScoutControls', () => {
    const defaultProps = {
        city: 'Nashville',
        setCity: vi.fn(),
        genre: 'Rock',
        setGenre: vi.fn(),
        isAutonomous: false,
        setIsAutonomous: vi.fn(),
        handleScan: vi.fn(),
        isScanning: false
    };

    it('renders all controls with accessible labels', () => {
        render(<ScoutControls {...defaultProps} />);

        expect(screen.getByLabelText('Target City')).toBeDefined();
        expect(screen.getByLabelText('Focus Genre')).toBeDefined();
        expect(screen.getByRole('switch', { name: 'Toggle autonomous mode' })).toBeDefined();
    });

    it('toggles autonomous mode and updates aria-checked', () => {
        const { rerender } = render(<ScoutControls {...defaultProps} />);

        const autoBtn = screen.getByRole('switch', { name: 'Toggle autonomous mode' });
        expect(autoBtn).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(autoBtn);
        expect(defaultProps.setIsAutonomous).toHaveBeenCalledWith(true);

        // Rerender with new state
        rerender(<ScoutControls {...defaultProps} isAutonomous={true} />);
        expect(screen.getByRole('switch', { name: 'Toggle autonomous mode' })).toHaveAttribute('aria-checked', 'true');
    });

    it('calls handleScan when deploy is clicked', () => {
        render(<ScoutControls {...defaultProps} />);

        const deployBtn = screen.getByText('Deploy Scout').closest('button');
        fireEvent.click(deployBtn!);

        expect(defaultProps.handleScan).toHaveBeenCalled();
    });

    it('disables deploy button and sets aria-busy when scanning', () => {
        render(<ScoutControls {...defaultProps} isScanning={true} />);

        const deployBtn = screen.getByText('Running...').closest('button');
        expect(deployBtn).toBeDisabled();
        expect(deployBtn).toHaveAttribute('aria-busy', 'true');
    });
});
