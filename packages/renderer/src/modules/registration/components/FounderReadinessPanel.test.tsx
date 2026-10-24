import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FounderReadinessPanel } from './FounderReadinessPanel';

describe('FounderReadinessPanel (ISSUE-1121)', () => {
  it('renders the founder prerequisite checklist and authoritative registration guidance', () => {
    render(<FounderReadinessPanel userId="test-user-1" />);

    expect(screen.getByText(/Founder Music-Identity Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/US ISRC Rights Owner Prefix/i)).toBeInTheDocument();
    expect(screen.getByText(/GS1 GTIN \/ UPC Ownership/i)).toBeInTheDocument();
    expect(screen.getByText(/DDEX Implementation Licence & DPID/i)).toBeInTheDocument();
    expect(screen.getByText(/PRO Writer & Publisher Affiliation/i)).toBeInTheDocument();
  });

  it('allows updating an identifier value and toggling verified status', () => {
    render(<FounderReadinessPanel userId="test-user-2" />);

    const isrcInput = screen.getByPlaceholderText('e.g. QZ-XXX');
    fireEvent.change(isrcInput, { target: { value: 'QZ-123' } });
    expect(isrcInput).toHaveValue('QZ-123');

    const isrcToggle = screen.getByRole('button', { name: 'Mark verified: US ISRC Rights Owner Prefix' });
    expect(isrcToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(isrcToggle);
    expect(screen.getByRole('button', { name: 'Mark pending: US ISRC Rights Owner Prefix' }))
      .toHaveAttribute('aria-pressed', 'true');

    const saveButton = screen.getByText(/Save Progress/i);
    fireEvent.click(saveButton);
    expect(screen.getByText(/Saved!/i)).toBeInTheDocument();
  });

  it('opens the selected official portal with opener isolation', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      render(<FounderReadinessPanel userId="test-user-3" />);
      const buttons = screen.getAllByRole('button', { name: /Open official portal/i });
      fireEvent.click(buttons[0]);
      expect(open).toHaveBeenCalledWith(
        'https://www.cisac.org/services/information-services/ipi',
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      open.mockRestore();
    }
  });
});
