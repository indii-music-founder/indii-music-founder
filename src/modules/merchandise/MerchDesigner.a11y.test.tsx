import React from 'react';
import { render, screen } from '@testing-library/react';
import MerchDesigner from './MerchDesigner';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/core/context/ToastContext';

// Mock fabric to avoid canvas issues
vi.mock('fabric', () => {
  const mockObject = {
    set: vi.fn(),
    on: vi.fn(),
    get: vi.fn(),
    visible: true,
    selectable: true,
    evented: true,
    toDataURL: vi.fn(),
    clone: vi.fn().mockResolvedValue({}),
    setCoords: vi.fn(),
  };

  return {
    Canvas: class {
      add = vi.fn();
      remove = vi.fn();
      sendObjectToBack = vi.fn();
      bringObjectToFront = vi.fn();
      renderAll = vi.fn();
      on = vi.fn();
      off = vi.fn();
      dispose = vi.fn();
      getObjects = vi.fn().mockReturnValue([]);
      toJSON = vi.fn();
      toObject = vi.fn().mockReturnValue({});
      setActiveObject = vi.fn();
      getActiveObject = vi.fn();
      getActiveObjects = vi.fn().mockReturnValue([]);
      discardActiveObject = vi.fn();
      loadFromJSON = vi.fn().mockResolvedValue(undefined);
      clear = vi.fn();
      toSVG = vi.fn();
      toDataURL = vi.fn();
      setZoom = vi.fn();
      setDimensions = vi.fn();
      getZoom = vi.fn().mockReturnValue(1);
      viewportTransform = [1, 0, 0, 1, 0, 0];
    },
    Object: { prototype: { set: vi.fn() } },
    Rect: vi.fn().mockImplementation(() => ({ ...mockObject, type: 'rect' })),
    IText: vi.fn().mockImplementation(() => ({ ...mockObject, type: 'i-text' })),
    Textbox: vi.fn().mockImplementation(() => ({ ...mockObject, type: 'textbox' })),
    ActiveSelection: vi.fn().mockImplementation(() => ({ ...mockObject, type: 'activeSelection', forEachObject: vi.fn() })),
    FabricImage: {
      fromURL: vi.fn().mockResolvedValue({
        ...mockObject,
        type: 'image',
        scaleToWidth: vi.fn(),
        set: vi.fn(),
        width: 100,
        height: 100
      })
    },
    Image: { fromURL: vi.fn().mockResolvedValue({ ...mockObject, type: 'image', scaleToWidth: vi.fn(), set: vi.fn() }) },
  };
});

// Mock useStore
vi.mock('@/core/store', () => ({
  useStore: vi.fn(() => ({
    userProfile: { displayName: 'Test User' },
    generatedHistory: [],
    uploadedImages: [],
    currentProjectId: 'test-project',
    organizations: [{ id: 'test-org', name: 'Test Org' }],
    currentOrganizationId: 'test-org'
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

    // Undo/Redo - use getAllByRole as there might be multiple (toolbar and mobile menu)
    const undoBtn = screen.getAllByRole('button', { name: /undo/i })[0];
    expect(undoBtn).toBeInTheDocument();

    const redoBtn = screen.getAllByRole('button', { name: /redo/i })[0];
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
