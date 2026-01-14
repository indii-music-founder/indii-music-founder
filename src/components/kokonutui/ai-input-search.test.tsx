import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import AI_Input_Search from './ai-input-search';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Globe: () => <div data-testid="icon-globe">Globe</div>,
  Paperclip: ({ className }: { className?: string }) => (
    <div data-testid="icon-paperclip" className={className}>
      Paperclip
    </div>
  ),
  Send: () => <div data-testid="icon-send">Send</div>,
  Loader2: () => <div data-testid="icon-loader">Loader2</div>,
}));

// Mock framer-motion/motion
vi.mock('motion/react', () => ({
  motion: {
    // Correctly filtering out framer-motion props to avoid React warnings
    div: ({ children, whileHover, animate, initial, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, whileHover, animate, initial, exit, transition, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock hook
vi.mock('@/hooks/use-auto-resize-textarea', () => ({
  useAutoResizeTextarea: () => ({
    textareaRef: { current: null },
    adjustHeight: vi.fn(),
  }),
}));

describe('AI_Input_Search Interaction', () => {
  it('handles the full Send lifecycle: Type -> Enable -> Click -> Submit -> Reset', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(<AI_Input_Search onSubmit={handleSubmit} placeholder="Ask me anything..." />);

    // 1. Initial State: Button should be disabled
    const sendButton = screen.getByRole('button', { name: /send prompt/i });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveClass('cursor-not-allowed');

    // 2. Interaction: Type text
    const input = screen.getByPlaceholderText('Ask me anything...');
    await user.type(input, 'Hello Click Agent');

    // 3. Feedback: Button becomes enabled
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).toHaveClass('cursor-pointer');
    expect(input).toHaveValue('Hello Click Agent');

    // 4. Action: Click Send
    await user.click(sendButton);

    // 5. Success Event: onSubmit called with trimmed value
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith('Hello Click Agent');

    // Note: Since onSubmit is provided, internal value is NOT cleared.
    expect(input).toHaveValue('Hello Click Agent');
  });

  it('handles Loading state correctly', () => {
    render(<AI_Input_Search isLoading={true} />);

    const sendButton = screen.getByRole('button', { name: /sending prompt/i });
    expect(sendButton).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-send')).not.toBeInTheDocument();
  });

  it('prevents sending empty or whitespace-only strings', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AI_Input_Search onSubmit={handleSubmit} placeholder="Type here..." />);

    const input = screen.getByPlaceholderText('Type here...');
    const sendButton = screen.getByRole('button', { name: /send prompt/i });

    // Type spaces
    await user.type(input, '   ');
    expect(sendButton).toBeDisabled();

    // Try to force click (though disabled)
    await user.click(sendButton);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits on Enter key (without Shift)', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AI_Input_Search onSubmit={handleSubmit} placeholder="Type here..." />);

    const input = screen.getByPlaceholderText('Type here...');
    await user.type(input, 'Quick message');

    // Press Enter
    await user.keyboard('{Enter}');

    expect(handleSubmit).toHaveBeenCalledWith('Quick message');
  });

  it('clears input automatically when no onSubmit prop is provided (default behavior)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();

    render(<AI_Input_Search placeholder="Type here..." />); // No onSubmit provided

    const input = screen.getByPlaceholderText('Type here...');
    const sendButton = screen.getByRole('button', { name: /send prompt/i });

    await user.type(input, 'Self clearing message');
    await user.click(sendButton);

    // Should log to console
    expect(consoleSpy).toHaveBeenCalledWith('Submit:', 'Self clearing message');

    // Should clear the input
    expect(input).toHaveValue('');

    consoleSpy.mockRestore();
  });

  it('toggles Search mode visibility on click', async () => {
    const user = userEvent.setup();
    render(<AI_Input_Search />);

    // Initial state: Search is visible (showSearch default is true)
    const toggleButton = screen.getByRole('button', { name: /hide search options/i });
    expect(toggleButton).toBeInTheDocument();

    // Check if "Search" text is visible
    expect(screen.getByText('Search')).toBeInTheDocument();

    // Click to toggle off
    await user.click(toggleButton);

    // Feedback: Aria label changes
    expect(toggleButton).toHaveAttribute('aria-label', 'Show search options');

    // Feedback: "Search" text disappears (mocked AnimatePresence removes it)
    await waitFor(() => {
      expect(screen.queryByText('Search')).not.toBeInTheDocument();
    });

    // Click to toggle on
    await user.click(toggleButton);

    // Feedback: Aria label changes back
    expect(toggleButton).toHaveAttribute('aria-label', 'Hide search options');
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('triggers file selection when Paperclip is clicked', async () => {
    const onFileSelect = vi.fn();
    const user = userEvent.setup();
    render(<AI_Input_Search onFileSelect={onFileSelect} />);

    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    const paperclipButton = screen.getByRole('button', { name: /attach file/i });
    const fileInput = screen.getByLabelText(/upload file/i); // Using aria-label on hidden input

    // Verify input is hidden
    expect(fileInput).toHaveClass('hidden');

    // Simulate file selection via user event on the input directly
    // (In a real browser, clicking the button triggers the input click, but in JSDOM we can simulate the upload directly)
    await user.upload(fileInput, file);

    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onFileSelect).toHaveBeenCalledWith(file);
    // Note: The component does NOT reset the file input value after selection,
    // so it will retain "C:\fakepath\hello.png" in JSDOM. We skip asserting empty value.
  });

  it('triggers file input click when Paperclip button is clicked', async () => {
    // This tests the wiring between the visible button and the hidden input
    const user = userEvent.setup();
    render(<AI_Input_Search />);

    const paperclipButton = screen.getByRole('button', { name: /attach file/i });
    const fileInput = screen.getByLabelText(/upload file/i);

    // Spy on the click method of the input
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(paperclipButton);

    expect(clickSpy).toHaveBeenCalled();
  });
});
