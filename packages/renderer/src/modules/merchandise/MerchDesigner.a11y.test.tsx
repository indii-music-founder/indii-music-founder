import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MerchDesigner from '@/modules/merchandise/MerchDesigner';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/core/context/ToastContext';

// Mock fabric to avoid canvas issues
vi.mock('fabric', () => {
  return {
    Canvas: class {
      add = vi.fn();
      sendObjectToBack = vi.fn();
      on = vi.fn();
      off = vi.fn();
      dispose = vi.fn();
      getObjects = vi.fn().mockReturnValue([]);
      getActiveObjects = vi.fn().mockReturnValue([]);
      setZoom = vi.fn();
      getZoom = vi.fn().mockReturnValue(1);
      setDimensions = vi.fn();
      discardActiveObject = vi.fn();
      toObject = vi.fn().mockReturnValue({});
      calcOffset = vi.fn();
      requestRenderAll = vi.fn();
      renderAll = vi.fn();
      setBackgroundColor = vi.fn().mockResolvedValue(undefined);
      clear = vi.fn().mockResolvedValue(undefined);
      getPointer = vi.fn().mockReturnValue({ x: 0, y: 0 });
      containsPoint = vi.fn().mockReturnValue(false);
      toJSON = vi.fn();
      setActiveObject = vi.fn();
      loadFromJSON = vi.fn().mockResolvedValue(undefined);
    },
    Rect: vi.fn(),
    IText: vi.fn(),
    Textbox: vi.fn(),
    Image: { fromURL: vi.fn().mockResolvedValue({ scaleToWidth: vi.fn(), set: vi.fn() }) },
    FabricObject: class { set = vi.fn() },
  };
});

vi.mock('@/core/store', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      userProfile: { displayName: 'Test User' },
      generatedHistory: [],
      uploadedImages: [],
      currentProjectId: 'test-project',
      organizations: [{ id: 'test-org', name: 'Test Org' }],
      currentOrganizationId: 'test-org',
      pendingHandoffs: {},
      consumeHandoff: vi.fn().mockReturnValue(null),
    };
    return selector ? selector(state) : state;
  }),
}));

describe('MerchDesigner Accessibility', () => {
  it.each([
    ['Assets', 'Layers'],
    ['Layers', 'Assets'],
  ])('preserves the collapsed %s panel after leaving Focus Canvas', (collapsed, expanded) => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: `Collapse ${collapsed} Panel` }));
    const focus = screen.getByRole('button', { name: /^Focus Canvas Mode/ });
    focus.focus();
    fireEvent.click(focus);
    const exit = screen.getByRole('button', { name: 'Exit Focus Canvas Mode' });
    expect(exit).toHaveFocus();
    expect(screen.queryByRole('complementary', { name: /assets panel|layers panel/i })).not.toBeInTheDocument();
    fireEvent.click(exit);

    expect(screen.getByRole('button', { name: `Expand ${collapsed} Panel` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Collapse ${expanded} Panel` })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: `${expanded} panel` })).toBeVisible();
    expect(screen.queryByRole('complementary', { name: `${collapsed} panel` })).not.toBeInTheDocument();
  });

  it('renders accessible color pickers', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Before fix: These fail because they are divs without roles/labels
    // After fix: These should pass
    // ISSUE-1440 residue: the swatches live inside a popover now — open it first.
    const trigger = screen.getByRole('button', { name: /select background color/i });
    // ISSUE-1440 residue: the swatch panel toggles from the color trigger.
    fireEvent.click(trigger);
    const colorButtons = await screen.findAllByRole('button', { name: /select color/i });
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
    expect(screen.getByRole('img', { name: 'Merchandise design preview' })).toBeInTheDocument();
  });

  it('renders accessible asset library tools', () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );

    // Verify Autonomous tool button is accessible (might appear in ToolButton and AssetLibrary)
    const autonomousBtns = screen.queryAllByRole('button', { name: /Autonomous/i });
    expect(autonomousBtns.length).toBeGreaterThan(0);

    // Verify Text tool
    const textBtns = screen.queryAllByRole('button', { name: /Text/i });
    expect(textBtns.length).toBeGreaterThan(0);

    // Verify Undo/Redo are accessible
    expect(screen.getAllByRole('button', { name: /Undo/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Redo/i })[0]).toBeInTheDocument();
  });
});

describe('MerchDesigner interactions and lifecycle', () => {
  function renderDesigner() {
    return render(
      <MemoryRouter initialEntries={['/merch/design']}>
        <ToastProvider>
          <MerchDesigner />
        </ToastProvider>
      </MemoryRouter>
    );
  }

  it('renders Agent / User mode toggle', () => {
    renderDesigner();
    const agentBtns = screen.queryAllByRole('button', { name: /agent/i });
    const userBtns = screen.queryAllByRole('button', { name: /user/i });
    expect(agentBtns.length + userBtns.length).toBeGreaterThan(0);
  });

  it('switches to Showroom view on button click', () => {
    renderDesigner();
    const showroomBtns = screen.getAllByRole('button', { name: /showroom/i });
    fireEvent.click(showroomBtns[0]!);
    expect(screen.getAllByRole('button', { name: /design/i }).length).toBeGreaterThan(0);
  });

  it('renders a design name input or editable heading', () => {
    renderDesigner();
    const nameInput = document.querySelector('input[placeholder*="ntitled"], input[aria-label*="design name" i]');
    const nameHeading = screen.queryByText(/untitled design/i);
    expect(nameInput || nameHeading).toBeTruthy();
  });

  it('allows typing a new design name', async () => {
    renderDesigner();
    fireEvent.click(screen.getByText(/untitled design/i));
    const nameInput = screen.getByDisplayValue('Untitled Design') as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Summer Drop Tee');
    expect(nameInput.value).toBe('Summer Drop Tee');
  });

  it('opens the autonomous generation dialog when Autonomous button is clicked', async () => {
    renderDesigner();
    const autonomousBtns = screen.getAllByRole('button', { name: /autonomous/i });
    fireEvent.click(autonomousBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText('Generate Images')).toBeInTheDocument();
    });
  });

  it('has no duplicate Undo/Redo button IDs', () => {
    renderDesigner();
    const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id).filter(Boolean);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
