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
  useStore: vi.fn(() => ({
    userProfile: { displayName: 'Test User' },
    generatedHistory: [],
    uploadedImages: [],
    currentProjectId: 'test-project'
  })),
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
    expect(colorButtons.length).toBe(6);
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

  it('renders accessible asset library tools', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify AI Gen button is accessible (might appear in ToolButton and AssetLibrary)
    const aiGenBtns = screen.queryAllByRole('button', { name: /AI Gen/i });
    expect(aiGenBtns.length).toBeGreaterThan(0);

    // Verify Text tool
    const textBtns = screen.queryAllByRole('button', { name: /Text/i });
    expect(textBtns.length).toBeGreaterThan(0);

    // Verify Undo/Redo are accessible
    expect(screen.getAllByRole('button', { name: /Undo/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Redo/i })[0]).toBeInTheDocument();
  });
});
