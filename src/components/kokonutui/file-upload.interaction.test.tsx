import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FileUpload from './file-upload';

// Mock framer-motion/motion to ensure children render immediately
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  UploadCloud: () => <div data-testid="icon-upload-cloud" />,
  Camera: () => <div data-testid="icon-camera" />,
}));

describe('FileUpload Interaction: Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes the full upload lifecycle: Select -> Uploading (Progress) -> Success -> Reset', async () => {
    const handleUploadSuccess = vi.fn();

    render(
      <FileUpload
        onUploadSuccess={handleUploadSuccess}
        uploadDelay={1000}
      />
    );

    const uploadButton = screen.getByRole('button', { name: /upload file/i });
    expect(uploadButton).toBeInTheDocument();

    const file = new File(['dummy content'], 'test-image.png', { type: 'image/png' });
    const input = screen.getByLabelText(/file input/i) as HTMLInputElement;

    // Using fireEvent to bypass user-event hanging on fake timers
    fireEvent.change(input, { target: { files: [file] } });

    // 3. Feedback: State changes to "uploading"
    // The "Upload File" button should be gone
    expect(screen.queryByRole('button', { name: /upload file/i })).not.toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();

    // Verify file name is displayed
    expect(screen.getByText('test-image.png')).toBeInTheDocument();

    // Verify initial progress (0%)
    expect(screen.getByText('0%')).toBeInTheDocument();

    // 4. Async Progress
    // Advance halfway (500ms)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const progressText = screen.getByText(/%/);
    // Explicitly check that it has moved to 50%
    expect(progressText).toHaveTextContent('50%');

    // NOTE: toHaveTextContent does partial matching by default if it's not exact.
    // '50%' contains '0%' if not anchored? No, '0%' is usually not in '50%'.
    // Wait, '50%' ends with '0%'. That's why the previous test failed with "Expected element not to have text content: 0% Received: 50%".
    // 50% has the substring "0%".
    // I should assert the exact text content.
    expect(progressText.textContent).toBe('50%');

    // 5. Completion
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // 6. Final State: Success & Reset
    expect(handleUploadSuccess).toHaveBeenCalledTimes(1);
    expect(handleUploadSuccess).toHaveBeenCalledWith(file);

    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
