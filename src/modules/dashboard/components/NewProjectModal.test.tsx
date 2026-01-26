import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewProjectModal from "./NewProjectModal";
import { vi } from "vitest";
import React from "react";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.ComponentProps<"div">) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

describe("NewProjectModal Accessibility", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
    error: null,
  };

  it("should have an accessible label for the Project Name input", () => {
    render(<NewProjectModal {...defaultProps} />);

    // This fails if the label is not associated with the input
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
  });

  it("should have a dialog role and proper labelling", () => {
    render(<NewProjectModal {...defaultProps} />);

    // This checks for role="dialog"
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // This checks if the dialog has an accessible name (linked to the title)
    expect(dialog).toHaveAttribute("aria-labelledby");
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(titleId!)).toHaveTextContent(
      "Create New Project",
    );
  });
});

describe("NewProjectModal Interaction", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate: vi.fn(),
    error: null,
  };

  it("shows loading state during creation", async () => {
    let resolveCreation: () => void;
    const onCreatePromise = new Promise<void>((resolve) => {
      resolveCreation = resolve;
    });
    const onCreate = vi.fn().mockReturnValue(onCreatePromise);

    render(
      <NewProjectModal
        {...defaultProps}
        onCreate={onCreate}
        initialName="My Project"
      />,
    );

    const createButton = screen.getByRole("button", {
      name: /create project/i,
    });

    // Click to start creation
    fireEvent.click(createButton);

    // Assert loading state
    expect(createButton).toBeDisabled();
    expect(screen.getByText(/creating.../i)).toBeInTheDocument();

    // Resolve the promise
    resolveCreation!();

    // Wait for loading state to finish (button should be enabled or component unmounted/closed)
    // In this specific component, it stays open until parent closes it, so we check if it reverts to enabled
    await waitFor(() => {
        expect(screen.queryByText(/creating.../i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /create project/i })).toBeEnabled();
  });
});
