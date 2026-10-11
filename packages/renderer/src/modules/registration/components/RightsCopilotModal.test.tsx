/**
 * RightsCopilotModal.test.tsx
 *
 * Unit tests for RightsCopilotModal (ISSUE-1511).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RightsCopilotModal } from './RightsCopilotModal';

describe('RightsCopilotModal (ISSUE-1511)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    portalTarget: 'loc_copyright' as const,
    artistLegalName: 'Jane Doe',
    artistStageName: 'JD Sonic',
    workTitle: 'Midnight Echoes',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<RightsCopilotModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders portal information, work title, and claimant details for US Copyright Office', () => {
    render(<RightsCopilotModal {...defaultProps} />);

    expect(screen.getByText(/U\.S\. Copyright Office eCO Registration/i)).toBeInTheDocument();
    expect(screen.getByText('Library of Congress')).toBeInTheDocument();
    expect(screen.getByText('Midnight Echoes')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/\$45 Single/i)).toBeInTheDocument();
    expect(screen.getByText(/Deposit Copy Staging \(Library of Congress\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Copilot Navigation Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/indii Privacy Guarantee/i)).toBeInTheDocument();
  });

  it('renders correctly for The MLC portal target without deposit staging', () => {
    render(<RightsCopilotModal {...defaultProps} portalTarget="the_mlc" />);

    expect(screen.getByText(/The Mechanical Licensing Collective/i)).toBeInTheDocument();
    expect(screen.getByText('The MLC')).toBeInTheDocument();
    expect(screen.getByText(/Free membership/i)).toBeInTheDocument();
    expect(screen.queryByText(/Deposit Copy Staging \(Library of Congress\)/i)).not.toBeInTheDocument();
  });

  it('handles copying the filing dossier', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<RightsCopilotModal {...defaultProps} />);

    const exportBtn = screen.getByRole('button', { name: /Export Filing Dossier/i });
    fireEvent.click(exportBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const briefContent = writeTextMock.mock.calls[0][0];
    expect(briefContent).toContain('Midnight Echoes');
    expect(briefContent).toContain('Jane Doe');
    expect(screen.getByText(/Dossier Copied!/i)).toBeInTheDocument();
  });

  it('triggers onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<RightsCopilotModal {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens registration URL in a new window when Electron IPC is not present', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<RightsCopilotModal {...defaultProps} />);

    const launchBtn = screen.getByRole('button', { name: /Launch Assisted Registration/i });
    fireEvent.click(launchBtn);

    expect(openSpy).toHaveBeenCalledWith(
      'https://eco.copyright.gov/ecoms/',
      '_blank',
      'noopener,noreferrer',
    );
    expect(screen.getByText(/Re-open Registration/i)).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('handles audio deposit staging and computes deterministic checksum', async () => {
    render(<RightsCopilotModal {...defaultProps} />);

    const file = new File(['fake-wav-binary-content'], 'master_track.wav', { type: 'audio/wav' });
    const input = screen.getByLabelText(/Select Master Audio File/i, { selector: 'input' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('master_track.wav')).toBeInTheDocument();
      expect(screen.getByText(/Verified Deposit/i)).toBeInTheDocument();
    });
  });
});
