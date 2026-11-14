import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('Table Component Mobile Responsiveness', () => {
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

  it('adds a named keyboard entry point only while columns overflow', () => {
    let measure: () => void = () => {};
    const disconnect = vi.fn();
    class TestResizeObserver {
      constructor(callback: () => void) { measure = callback; }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    try {
      const { unmount } = render(<Table aria-label="Royalties" />);
      const wrapper = screen.getByRole('table', { name: 'Royalties' }).parentElement!;
      expect(wrapper).not.toHaveAttribute('tabindex');

      Object.defineProperties(wrapper, {
        clientWidth: { configurable: true, value: 375 },
        scrollWidth: { configurable: true, value: 640 },
      });
      act(measure);
      expect(screen.getByRole('region', { name: 'Royalties' })).toBe(wrapper);
      expect(wrapper).toHaveAttribute('tabindex', '0');

      Object.defineProperty(wrapper, 'clientWidth', { value: 640 });
      act(measure);
      expect(wrapper).not.toHaveAttribute('tabindex');
      expect(screen.queryByRole('region')).toBeNull();

      unmount();
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders with overflow auto wrapper to prevent layout breakage', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column 1</TableHead>
            <TableHead>Column 2</TableHead>
            <TableHead>Column 3</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Data 1</TableCell>
            <TableCell>Data 2</TableCell>
            <TableCell>Data 3</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    // The Table component wraps the <table> in a div.
    // We need to find that wrapper. The Table component structure is:
    // <div className="relative w-full overflow-auto">
    //   <table ...>
    // </div>

    const table = screen.getByRole('table');
    const wrapper = table.parentElement;

    expect(wrapper).toHaveClass('relative');
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).toHaveClass('overflow-auto');
  });

  it('handles "stress test" wide content without breaking constraints', () => {
    // ⚡ Stress Test: A table with many columns that definitely exceeds 375px
    const columns = Array.from({ length: 20 }, (_, i) => `Col ${i}`);

    render(
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
             {columns.map(col => <TableCell key={col}>Data {col}</TableCell>)}
          </TableRow>
        </TableBody>
      </Table>
    );

    const table = screen.getByRole('table');
    const wrapper = table.parentElement;

    // Check wrapper properties again to ensure they persist with content
    expect(wrapper).toHaveClass('overflow-auto');

    // Check that table has w-full class as per component definition
    expect(table).toHaveClass('w-full');
  });
});
