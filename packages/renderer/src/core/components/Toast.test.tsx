import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toast, ToastMessage } from './Toast';

// Mock motion
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Toast Component', () => {
    const mockOnDismiss = vi.fn();
    const defaultToast: ToastMessage = {
        id: '123',
        type: 'success',
        message: 'Test message',
    };

    it('renders the message correctly', () => {
        render(<Toast toast={defaultToast} onDismiss={mockOnDismiss} />);
        expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('renders the close button with an accessible label', () => {
        render(<Toast toast={defaultToast} onDismiss={mockOnDismiss} />);

        // Find the button containing the X icon (lucide X usually renders an svg)
        // We look for a button that has the accessible name "Dismiss notification"
        const closeButton = screen.getByRole('button', { name: /dismiss notification/i });
        expect(closeButton).toBeInTheDocument();

        fireEvent.click(closeButton);
        expect(mockOnDismiss).toHaveBeenCalledWith('123');
    });

    it('does not render close button for loading toasts', () => {
        const loadingToast: ToastMessage = {
            ...defaultToast,
            type: 'loading',
        };
        render(<Toast toast={loadingToast} onDismiss={mockOnDismiss} />);

        const closeButton = screen.queryByRole('button');
        expect(closeButton).not.toBeInTheDocument();
    });
});
