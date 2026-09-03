import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormatFoundryModule } from './FormatFoundryModule';

describe('FormatFoundryModule', () => {
  it('renders initial state with clean-room badges and input', () => {
    render(<FormatFoundryModule />);

    expect(screen.getByText('Format Intelligence & Capability Foundry')).toBeInTheDocument();
    expect(screen.getByText('Clean-Room Engine')).toBeInTheDocument();
    expect(screen.getByText(/Local-First Private Analysis/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste raw sales statement/)).toBeInTheDocument();
  });

  it('loads preset DistroKid TSV and displays forensics and validation', async () => {
    render(<FormatFoundryModule />);

    const presetBtn = screen.getByText('DistroKid TSV (2026.1)');
    fireEvent.click(presetBtn);

    // Forensics section
    expect(await screen.findByText('Format Forensics')).toBeInTheDocument();
    expect(screen.getByText('distrokid_statement')).toBeInTheDocument();

    // 7-Layer validation
    expect(screen.getByText('7-Layer Validation Matrix')).toBeInTheDocument();
    expect(screen.getByText('ALL LAYERS PASSED')).toBeInTheDocument();

    // Business Graph
    expect(screen.getByText('Artist Business Graph Normalization')).toBeInTheDocument();
    expect(screen.getAllByText('Velvet Voltage').length).toBeGreaterThan(0);
    expect(screen.getByText('Kira Novakowski')).toBeInTheDocument();
  });

  it('handles consequential approval flow', async () => {
    render(<FormatFoundryModule />);

    const presetBtn = screen.getByText('DistroKid TSV (2026.1)');
    fireEvent.click(presetBtn);

    const approveBtn = await screen.findByText('Approve & Book Statement');
    expect(approveBtn).toBeInTheDocument();

    fireEvent.click(approveBtn);
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });
});
