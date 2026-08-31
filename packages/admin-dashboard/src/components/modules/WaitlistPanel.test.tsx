import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const adminActions = vi.hoisted(() => ({
  inviteNextFoundingArtist: vi.fn(),
  queueFoundingArtistMilestoneUpdate: vi.fn(),
}));

vi.mock('../../lib/foundingArtistAdmin', () => adminActions);

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
    vi.stubGlobal('confirm', vi.fn(() => true));
    localStorage.setItem('indii_admin_token', 'admin-token');
    adminActions.inviteNextFoundingArtist.mockResolvedValue({
      queued: true,
      alreadyQueued: false,
      artistUid: 'uid-1',
      email: 'verified@example.com',
      queuePosition: 1,
      communicationId: 'invite-1',
    });
    adminActions.queueFoundingArtistMilestoneUpdate.mockResolvedValue({
      campaignId: 'campaign-1',
      recipientCount: 1,
      alreadyQueued: false,
    });
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
      milestoneOptInCount: 1,
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
          invitationStatus: 'not_queued',
          majorMilestoneUpdates: true,
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
          invitationStatus: 'not_queued',
          majorMilestoneUpdates: false,
        },
      ],
    }));

    render(<WaitlistPanel />);

    await waitFor(() => expect(screen.getByText('artist@example.com')).toBeDefined());
    expect(screen.getByText('verified@example.com')).toBeDefined();
    expect(screen.getByText('waitlisted')).toBeDefined();
    expect(screen.getByText('not queued')).toBeDefined();
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
      milestoneOptInCount: 0,
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

  it('requires confirmation and queues only the first verified waitlisted artist', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 1,
      totalSubmissions: 1,
      verifiedCount: 1,
      unverifiedCount: 0,
      milestoneOptInCount: 1,
      verificationEnabled: true,
      entries: [{
        id: 'verified:uid-1',
        email: 'verified@example.com',
        joinedAt: '2026-08-02T10:00:00.000Z',
        source: 'landing_page',
        submissionCount: 1,
        submissionOrder: 1,
        verificationStatus: 'verified',
        status: 'waitlisted',
        invitationStatus: 'not_queued',
        majorMilestoneUpdates: true,
      }],
    }));
    render(<WaitlistPanel />);

    const button = await screen.findByRole('button', { name: /Invite next/ });
    fireEvent.click(button);

    await waitFor(() => expect(adminActions.inviteNextFoundingArtist).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('#1 verified@example.com'));
    expect(await screen.findByText(/Invitation queued for #1/)).toBeDefined();
  });

  it('queues a confirmed milestone update for the server-filtered audience', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({
      count: 1,
      totalSubmissions: 1,
      verifiedCount: 1,
      unverifiedCount: 0,
      milestoneOptInCount: 1,
      verificationEnabled: true,
      entries: [{
        id: 'verified:uid-1', email: 'verified@example.com', joinedAt: null,
        source: 'landing_page', submissionCount: 1, submissionOrder: 1,
        verificationStatus: 'verified', status: 'invited', invitationStatus: 'sent',
        majorMilestoneUpdates: true,
      }],
    }));
    render(<WaitlistPanel />);

    fireEvent.change(await screen.findByLabelText('Milestone email subject'), { target: { value: 'The app is ready' } });
    fireEvent.change(screen.getByLabelText('Milestone email message'), { target: { value: 'We reached a major milestone.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Queue major milestone' }));

    await waitFor(() => expect(adminActions.queueFoundingArtistMilestoneUpdate).toHaveBeenCalledWith(
      'The app is ready',
      'We reached a major milestone.',
      expect.any(String),
    ));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 opted-in artist'));
  });
});
