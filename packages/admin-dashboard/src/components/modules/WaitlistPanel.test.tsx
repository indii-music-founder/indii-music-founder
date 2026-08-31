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

  it('renders real waitlist entries as unverified', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 1,
      totalSubmissions: 2,
      verificationEnabled: false,
      entries: [{
        id: 'entry-1',
        email: 'artist@example.com',
        joinedAt: '2026-08-01T10:00:00.000Z',
        source: 'landing_page',
        submissionCount: 2,
        submissionOrder: 1,
        verificationStatus: 'unverified',
      }],
    }));

    render(<WaitlistPanel />);

    await waitFor(() => expect(screen.getByText('artist@example.com')).toBeDefined());
    expect(screen.getByText('Unverified')).toBeDefined();
    expect(screen.getByText(/not eligible for invitations/)).toBeDefined();
    expect(fetch).toHaveBeenCalledWith('/api/waitlist', expect.objectContaining({
      headers: { Authorization: 'Bearer admin-token' },
    }));
  });

  it('does not invent records when the waitlist is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 0,
      totalSubmissions: 0,
      verificationEnabled: false,
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
