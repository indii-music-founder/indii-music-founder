import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NewProjectModal from './NewProjectModal';

// Mock motion
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

describe('💓 Pulse: NewProjectModal Feedback Loops', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onCreate: vi.fn(),
        error: null,
        initialName: '',
    };

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('Scenario: The "Loading" Pulse - Instant feedback on action', async () => {
        // Setup: Slow creation
        let resolveCreation: () => void;
        const onCreate = vi.fn().mockReturnValue(new Promise<void>((resolve) => {
            resolveCreation = resolve;
        }));

        render(<NewProjectModal {...defaultProps} onCreate={onCreate} initialName="My Project" />);

        const createButton = screen.getByRole('button', { name: /create project/i });

        // Action: Click Create
        fireEvent.click(createButton);

        // Assert: Loading State appears IMMEDIATELY
        expect(screen.getByText(/creating.../i)).toBeInTheDocument();
        expect(createButton).toBeDisabled();

        // Finish
        resolveCreation!();

        await waitFor(() => {
            expect(screen.queryByText(/creating.../i)).not.toBeInTheDocument();
        });
    });

    it('Scenario: The "Error" Feedback Loop - Failures are loud and clear', async () => {
        // Setup: Mock parent component behavior
        // We need to simulate the parent re-rendering the modal with the error prop
        // after the promise rejects.

        const ParentWrapper = () => {
            const [error, setError] = React.useState<string | null>(null);

            const handleCreate = async () => {
                // Simulate network delay then failure
                await new Promise(resolve => setTimeout(resolve, 10));
                setError("Project name already exists");
                throw new Error("Failed");
            };

            return (
                <NewProjectModal
                    {...defaultProps}
                    onCreate={handleCreate}
                    error={error}
                    initialName="Duplicate Project"
                />
            );
        };

        render(<ParentWrapper />);

        const createButton = screen.getByRole('button', { name: /create project/i });

        // Action: Click Create
        fireEvent.click(createButton);

        // Assert: Loading appears
        expect(screen.getByText(/creating.../i)).toBeInTheDocument();

        // Wait for error to appear
        // This implicitly asserts the loading state clears because the button text changes back
        // and the error appears.

        // We specifically check for role="alert" to ensure accessibility
        // This is expected to FAIL initially until we add role="alert" to the component
        const errorAlert = await screen.findByRole('alert');
        expect(errorAlert).toHaveTextContent("Project name already exists");

        // Assert: Loading is gone (pulse stopped)
        expect(screen.queryByText(/creating.../i)).not.toBeInTheDocument();

        // Assert: Button is enabled again (retry is possible)
        expect(screen.getByRole('button', { name: /create project/i })).toBeEnabled();
    });
});
