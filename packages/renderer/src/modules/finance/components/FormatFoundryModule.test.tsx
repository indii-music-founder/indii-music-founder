import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormatFoundryModule } from './FormatFoundryModule';

const mocks = vi.hoisted(() => ({
  grantSession: vi.fn().mockResolvedValue({ success: true }),
  bookStatement: vi.fn().mockResolvedValue({ success: true, bookedAt: '2026-11-08T00:00:00Z', receiptHash: 'hash-123' }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  currentUser: { uid: 'user-foundry-123' },
}));

vi.mock('@/services/firebase', () => ({
  db: {},
  get auth() {
    return { currentUser: mocks.currentUser };
  },
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
    setDoc: mocks.setDoc,
    serverTimestamp: vi.fn(() => 'server-timestamp'),
  };
});

describe('FormatFoundryModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        foundry: {
          grantSession: mocks.grantSession,
          bookStatement: mocks.bookStatement,
        },
      },
    });
  });

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
    expect(await screen.findByText('7-Layer Validation Matrix')).toBeInTheDocument();
    expect(await screen.findByText('ALL LAYERS PASSED')).toBeInTheDocument();

    // Business Graph
    expect(await screen.findByText('Artist Business Graph Normalization')).toBeInTheDocument();
    expect(screen.getAllByText('Velvet Voltage').length).toBeGreaterThan(0);
    expect(await screen.findByText('Kira Novakowski')).toBeInTheDocument();
  });

  it('handles consequential approval flow, invoking foundry:book-statement and persisting to Firestore', async () => {
    render(<FormatFoundryModule />);

    const presetBtn = screen.getByText('DistroKid TSV (2026.1)');
    fireEvent.click(presetBtn);

    const approveBtn = await screen.findByText('Approve & Book Statement');
    expect(approveBtn).toBeInTheDocument();

    fireEvent.click(approveBtn);
    expect(await screen.findByText('Booked')).toBeInTheDocument();

    expect(mocks.grantSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: expect.stringMatching(/^foundry_/),
      ttlMs: 60_000,
    }));
    expect(mocks.bookStatement).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: expect.stringMatching(/^foundry_/),
      statementId: expect.any(String),
      normalizedReportJson: expect.stringContaining('distrokid_statement'),
    }));
    expect(mocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('earnings_reports/') }),
      expect.objectContaining({
        userId: 'user-foundry-123',
        status: 'booked',
        formatId: 'distrokid_statement',
      }),
      { merge: true },
    );
  });
});
