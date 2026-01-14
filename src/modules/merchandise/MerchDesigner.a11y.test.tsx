import React from 'react';
import { render, screen } from '@testing-library/react';
import MerchDesigner from './MerchDesigner';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/core/context/ToastContext';

// Mock fabric to avoid canvas issues
vi.mock('fabric', () => {
  return {
    Canvas: class {
      add = vi.fn();
      sendObjectToBack = vi.fn();
      renderAll = vi.fn();
      on = vi.fn();
      dispose = vi.fn();
      getObjects = vi.fn().mockReturnValue([]);
      toJSON = vi.fn();
      setActiveObject = vi.fn();
      loadFromJSON = vi.fn().mockResolvedValue(undefined);
    },
    Rect: vi.fn(),
    IText: vi.fn(),
    Image: { fromURL: vi.fn().mockResolvedValue({ scaleToWidth: vi.fn(), set: vi.fn() }) },
  };
});

// Mock useStore
vi.mock('@/core/store', () => ({
  useStore: vi.fn(() => ({ userProfile: { displayName: 'Test User' } })),
}));

describe('MerchDesigner Accessibility', () => {
  it('renders accessible color pickers', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Before fix: These fail because they are divs without roles/labels
    // After fix: These should pass
    const colorButtons = screen.queryAllByRole('button', { name: /select color/i });
    expect(colorButtons.length).toBe(5);
  });

  it('renders accessible icon buttons', () => {
     render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Undo/Redo
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeInTheDocument();

    const redoBtn = screen.getByRole('button', { name: /redo/i });
    expect(redoBtn).toBeInTheDocument();
  });

  it('renders accessible emoji and asset pickers', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify emojis are accessible buttons
    const emojiButtons = screen.queryAllByRole('button', { name: /add emoji/i });
    // This assertion should fail initially as they are divs
    expect(emojiButtons.length).toBeGreaterThan(0);

    // Check specific emoji
    const shirtEmojiBtn = screen.getByRole('button', { name: /add emoji 👕/i });
    expect(shirtEmojiBtn).toBeInTheDocument();
  });
});
