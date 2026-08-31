import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  functions: { region: 'us-central1' },
  callable: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('../firebase', () => ({ functions: mocks.functions }));

import {
  inviteNextFoundingArtist,
  queueFoundingArtistMilestoneUpdate,
} from './foundingArtistAdmin';

describe('Founding Artist admin callable client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.httpsCallable.mockReturnValue(mocks.callable);
  });

  it('uses the administrator-only next-in-line callable', async () => {
    mocks.callable.mockResolvedValue({ data: { queued: true, alreadyQueued: false } });
    await inviteNextFoundingArtist();
    expect(mocks.httpsCallable).toHaveBeenCalledWith(mocks.functions, 'inviteNextFoundingArtist');
    expect(mocks.callable).toHaveBeenCalledWith({});
  });

  it('sends a stable request id with plain milestone content', async () => {
    mocks.callable.mockResolvedValue({ data: { campaignId: 'request-id', recipientCount: 2, alreadyQueued: false } });
    await queueFoundingArtistMilestoneUpdate('Subject', 'Message', 'request-id');
    expect(mocks.httpsCallable).toHaveBeenCalledWith(mocks.functions, 'queueFoundingArtistMilestoneUpdate');
    expect(mocks.callable).toHaveBeenCalledWith({
      requestId: 'request-id',
      subject: 'Subject',
      message: 'Message',
    });
  });
});
