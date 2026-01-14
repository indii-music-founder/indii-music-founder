import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

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

        const deployBtn = screen.getByTestId('deploy-scout-btn');
        fireEvent.click(deployBtn);

        expect(defaultProps.handleScan).toHaveBeenCalled();
    });

    it('disables deploy button and sets aria-busy when scanning', () => {
        render(<ScoutControls {...defaultProps} isScanning={true} />);

        const deployBtn = screen.getByTestId('deploy-scout-btn');
        expect(deployBtn).toBeDisabled();
        expect(deployBtn).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('scout-loading-spinner')).toBeDefined();
    });

    it('Deploy button lifecycle: click -> loading -> disabled', () => {
        // 1. Initial State: Ready
        const { rerender } = render(<ScoutControls {...defaultProps} />);
        const deployBtn = screen.getByTestId('deploy-scout-btn');

        expect(deployBtn).toBeEnabled();
        expect(deployBtn).not.toHaveAttribute('aria-busy', 'true');
        expect(screen.queryByTestId('scout-loading-spinner')).toBeNull();

        // 2. Action: Click
        fireEvent.click(deployBtn);
        expect(defaultProps.handleScan).toHaveBeenCalledTimes(1);

        // 3. State Change: Loading (simulated parent update)
        rerender(<ScoutControls {...defaultProps} isScanning={true} />);

        // 4. Verify Feedback: Disabled & Loading Spinner
        expect(deployBtn).toBeDisabled();
        expect(deployBtn).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('scout-loading-spinner')).toBeInTheDocument();
        expect(deployBtn).toHaveTextContent('Running...');

        // 5. Spam Protection: Attempt another click
        fireEvent.click(deployBtn);
        // handleScan should NOT be called again because the button is disabled
        expect(defaultProps.handleScan).toHaveBeenCalledTimes(1);

        // 6. Final State: Ready (simulated completion)
        rerender(<ScoutControls {...defaultProps} isScanning={false} />);
        expect(deployBtn).toBeEnabled();
        expect(deployBtn).not.toHaveAttribute('aria-busy', 'true');
        expect(screen.queryByTestId('scout-loading-spinner')).toBeNull();
        expect(deployBtn).toHaveTextContent('Deploy Scout');
    });
});
