import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WaitlistPanel } from './WaitlistPanel';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('WaitlistPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem('indii_admin_token', 'admin-token');
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders canonical and legacy states without treating them as equivalent', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 2,
      totalSubmissions: 2,
      verifiedCount: 1,
      unverifiedCount: 1,
      verificationEnabled: true,
      entries: [
        {
          id: 'verified:uid-1',
          email: 'verified@example.com',
          joinedAt: '2026-08-02T10:00:00.000Z',
          source: 'landing_page',
          submissionCount: 1,
          submissionOrder: 1,
          verificationStatus: 'verified',
          status: 'waitlisted',
        },
        {
          id: 'legacy:entry-1',
          email: 'artist@example.com',
          joinedAt: '2026-08-01T10:00:00.000Z',
          source: 'landing_page',
          submissionCount: 2,
          submissionOrder: 1,
          verificationStatus: 'unverified',
          status: 'legacy_unverified',
        },
      ],
    }));

    render(<WaitlistPanel />);

    await waitFor(() => expect(screen.getByText('artist@example.com')).toBeDefined());
    expect(screen.getByText('verified@example.com')).toBeDefined();
    expect(screen.getByText('waitlisted')).toBeDefined();
    expect(screen.getAllByText('Unverified')).toHaveLength(2);
    expect(screen.getByText(/not eligible for invitations/)).toBeDefined();
    expect(fetch).toHaveBeenCalledWith('/api/waitlist', expect.objectContaining({
      headers: { Authorization: 'Bearer admin-token' },
    }));
  });

  it('does not invent records when the waitlist is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 0,
      totalSubmissions: 0,
      verifiedCount: 0,
      unverifiedCount: 0,
      verificationEnabled: true,
      entries: [],
    }));

    render(<WaitlistPanel />);
    await waitFor(() => expect(screen.getByText('No waitlist submissions yet')).toBeDefined());
  });

  it('keeps email addresses behind administrator authentication', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));
    render(<WaitlistPanel />);
    await waitFor(() => expect(screen.getByText('Admin authentication required')).toBeDefined());
  });
});
