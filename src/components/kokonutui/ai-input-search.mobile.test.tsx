import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AI_Input_Search from './ai-input-search';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Globe: () => <div data-testid="icon-globe">Globe</div>,
  Paperclip: () => <div data-testid="icon-paperclip">Paperclip</div>,
  Send: () => <div data-testid="icon-send">Send</div>,
  Loader2: () => <div data-testid="icon-loader">Loader2</div>,
}));

// Mock framer-motion/motion
vi.mock('motion/react', () => ({
  motion: {
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

describe('AI_Input_Search Mobile Responsiveness', () => {
  const ORIGINAL_INNER_WIDTH = window.innerWidth;

  beforeEach(() => {
    // 📱 Set viewport to iPhone SE width (375px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event('resize'));
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: ORIGINAL_INNER_WIDTH,
    });
  });

  it('renders full width on mobile', () => {
    render(<AI_Input_Search />);
    // The outer container should have w-full
    const container = screen.getByRole('group', { name: /search input group/i });
    expect(container).toHaveClass('w-full');
    expect(container.parentElement).toHaveClass('w-full');
  });

  it('uses a flexible toolbar layout instead of absolute positioning for resilience', () => {
    render(<AI_Input_Search />);

    // Find the toolbar container (parent of the buttons)
    // We expect the immediate parent of the 'Attach file' button to be a flex container or part of a flex structure
    // In the refactored version, we want the "h-12" container to use flexbox.
    const attachButton = screen.getByRole('button', { name: /attach file/i });
    const toolbar = attachButton.closest('div[class*="bg-black/5"]'); // selecting by bg color used in toolbar

    expect(toolbar).toHaveClass('flex');
    expect(toolbar).not.toHaveClass('h-12'); // Should not have fixed height
    expect(toolbar).toHaveClass('min-h-[44px]'); // Should have minimum height constraint
  });

  it('ensures touch targets are "Fat Finger" friendly (>= 44px)', () => {
    render(<AI_Input_Search />);

    const buttons = [
      screen.getByRole('button', { name: /attach file/i }),
      screen.getByRole('button', { name: /hide search options/i }), // Default state
      screen.getByRole('button', { name: /send prompt/i })
    ];

    buttons.forEach(button => {
        // We check for utility classes that enforce size or padding
        // Tailwind: h-11 is 44px. min-h-[44px] is explicit.
        // OR p-3 (12px * 2 + 16px icon = 40px... close but maybe p-3.5 or p-4 is safer? or just h-11 w-11 flex center)
        // Let's verify we use h-11 w-11 or similar specific sizing for mobile.
        const classes = button.getAttribute('class') || '';
        const hasMobileSize = classes.includes('h-11') || classes.includes('min-h-[44px]') || classes.includes('min-w-[44px]');

        expect(hasMobileSize, `Button "${button.getAttribute('aria-label')}" should have mobile-friendly dimensions (h-11 or min-h-[44px])`).toBe(true);
    });
  });

  it('maintains the input area accessibility', () => {
    render(<AI_Input_Search placeholder="Type..." />);
    const textarea = screen.getByPlaceholderText('Type...');
    // Textarea should have sufficient padding and touch area
    expect(textarea).toHaveClass('px-4');
    expect(textarea).toHaveClass('py-3');
  });
});
