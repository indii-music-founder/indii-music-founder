import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import NewProjectModal from "./NewProjectModal";
import { vi } from "vitest";
import React from "react";

// Mock motion to avoid animation issues in tests
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, className, ...props }: React.ComponentProps<"div">) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

// ISSUE-1207: NewProjectModal is now a react-call dialog. Render the real
// Root, then trigger it via .call() — this mounts an active call item, same
// as production usage (RecentProjects.tsx calls NewProjectModal.call(...)).
function openModal(props: { onCreate: (name: string, type: any) => Promise<string>; initialName?: string }) {
  render(<NewProjectModal />);
  act(() => {
    void NewProjectModal.call(props);
  });
}

describe("NewProjectModal Accessibility", () => {
  const onCreate = vi.fn().mockResolvedValue("new-id");

  beforeEach(() => {
    vi.clearAllMocks();
    onCreate.mockResolvedValue("new-id");
  });

  it("should have an accessible label for the Project Name input", async () => {
    openModal({ onCreate });

    // This fails if the label is not associated with the input
    expect(await screen.findByLabelText(/project name/i)).toBeInTheDocument();
  });

  it("should have a dialog role and proper labelling", async () => {
    openModal({ onCreate });

    // This checks for role="dialog"
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // This checks if the dialog has an accessible name (linked to the title)
    expect(dialog).toHaveAttribute("aria-labelledby");
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(titleId!)).toHaveTextContent(
      "Create New Project",
    );
  });

  it("should close when clicking the close button", async () => {
    openModal({ onCreate });
    await screen.findByRole("dialog");

    const closeButton = screen.getByLabelText("Close modal");
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should close when clicking the backdrop", async () => {
    openModal({ onCreate });
    const dialog = await screen.findByRole("dialog");

    // The backdrop is the dialog's parent (the fixed inset-0 overlay div).
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("should not close when clicking the modal content", async () => {
    openModal({ onCreate });
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog);

    // Still open — clicking inside the panel must not dismiss it.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("NewProjectModal Interaction", () => {
  it("shows loading state during creation", async () => {
    let resolveCreation: (id: string) => void;
    const onCreatePromise = new Promise<string>((resolve) => {
      resolveCreation = resolve;
    });
    const onCreate = vi.fn().mockReturnValue(onCreatePromise);

    openModal({ onCreate, initialName: "My Project" });
    await screen.findByRole("dialog");

    const createButton = screen.getByRole("button", {
      name: /create project/i,
    });

    // Click to start creation
    fireEvent.click(createButton);

    // Assert loading state
    expect(createButton).toBeDisabled();
    expect(screen.getByText(/creating.../i)).toBeInTheDocument();

    // Resolve the promise
    resolveCreation!("new-id");

    // On success the dialog closes itself (call.end(id)) rather than
    // reverting to an idle, still-open state.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows an error and stays open when onCreate rejects", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Name already taken"));
    openModal({ onCreate, initialName: "My Project" });
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    expect(await screen.findByText("Name already taken")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
