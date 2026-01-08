import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import AI_Input_Search from './ai-input-search';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Globe: () => <div data-testid="icon-globe">Globe</div>,
  Paperclip: ({ onClick }: { onClick: () => void }) => (
    <div data-testid="icon-paperclip" onClick={onClick}>
      Paperclip
    </div>
  ),
  Send: () => <div data-testid="icon-send">Send</div>,
  Loader2: () => <div data-testid="icon-loader">Loader2</div>,
}));

// Mock framer-motion/motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
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
    // We use placeholder to select the specific textarea, avoiding conflict with container role="textbox"
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
});
