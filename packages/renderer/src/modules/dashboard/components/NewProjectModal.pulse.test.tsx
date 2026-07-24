import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

// ISSUE-1207: NewProjectModal is now a react-call dialog — render the real
// Root, then trigger via .call(), matching production usage in RecentProjects.tsx.
function openModal(props: { onCreate: (name: string, type: any) => Promise<string>; initialName?: string }) {
  render(<NewProjectModal />);
  act(() => {
    void NewProjectModal.call(props);
  });
}

describe('💓 Pulse: NewProjectModal Feedback Loops', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('Scenario: The "Loading" Pulse - Instant feedback on action', async () => {
        // Setup: Slow creation
        let resolveCreation: (id: string) => void;
        const onCreate = vi.fn().mockReturnValue(new Promise<string>((resolve) => {
            resolveCreation = resolve;
        }));

        openModal({ onCreate, initialName: "My Project" });
        await screen.findByRole('dialog');

        const createButton = screen.getByRole('button', { name: /create project/i });

        // Action: Click Create
        fireEvent.click(createButton);

        // Assert: Loading State appears IMMEDIATELY
        expect(screen.getByText(/creating.../i)).toBeInTheDocument();
        expect(createButton).toBeDisabled();

        // Finish
        resolveCreation!('new-id');

        // On success the dialog closes itself (call.end(id)).
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('Scenario: The "Error" Feedback Loop - Failures are loud and clear', async () => {
        // Error state now lives in the dialog itself (fixing the real bug this
        // test file's name hints at: the old version took an `error` prop that
        // its only real caller, RecentProjects.tsx, hardcoded to `null` and
        // never actually wired up — every failure was silently swallowed).
        const onCreate = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error("Project name already exists");
        });

        openModal({ onCreate, initialName: "Duplicate Project" });
        await screen.findByRole('dialog');

        const createButton = screen.getByRole('button', { name: /create project/i });

        // Action: Click Create
        fireEvent.click(createButton);

        // Assert: Loading appears
        expect(screen.getByText(/creating.../i)).toBeInTheDocument();

        // We specifically check for role="alert" to ensure accessibility.
        const errorAlert = await screen.findByRole('alert');
        expect(errorAlert).toHaveTextContent("Project name already exists");

        // Assert: Loading is gone (pulse stopped)
        expect(screen.queryByText(/creating.../i)).not.toBeInTheDocument();

        // Assert: Button is enabled again (retry is possible) and the dialog
        // stayed open — a failed create must not silently discard the draft.
        expect(screen.getByRole('button', { name: /create project/i })).toBeEnabled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
