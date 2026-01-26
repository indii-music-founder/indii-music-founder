import { render, screen, fireEvent } from "@testing-library/react";
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("should close when clicking the close button", () => {
    render(<NewProjectModal {...defaultProps} />);

    const closeButton = screen.getByLabelText("Close modal");
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should close when clicking the backdrop", () => {
    const { container } = render(<NewProjectModal {...defaultProps} />);

    // The backdrop is the root element in the component
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("should not close when clicking the modal content", () => {
    render(<NewProjectModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
