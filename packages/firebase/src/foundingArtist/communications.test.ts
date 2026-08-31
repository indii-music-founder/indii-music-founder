import { describe, expect, it, vi } from 'vitest';
import type * as admin from 'firebase-admin';
import {
  deliverFoundingArtistInvitation,
  deliverFoundingArtistMilestoneCampaign,
} from './communications';

function applyUpdate(target: Record<string, unknown>, update: Record<string, unknown>) {
  for (const [key, value] of Object.entries(update)) {
    const parts = key.split('.');
    let cursor = target;
    for (const part of parts.slice(0, -1)) {
      if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts.at(-1) as string] = value;
  }
}

function makeFirestore(initial: Record<string, Record<string, unknown>>) {
  const store = new Map(Object.entries(initial).map(([path, data]) => [path, structuredClone(data)]));

  class FakeRef {
    readonly id: string;
    constructor(readonly path: string) {
      this.id = path.split('/').at(-1) as string;
    }
    collection(name: string) {
      return new FakeCollection(`${this.path}/${name}`);
    }
    async get() {
      const data = store.get(this.path);
      return { exists: Boolean(data), id: this.id, data: () => data ? structuredClone(data) : undefined };
    }
    async update(data: Record<string, unknown>) {
      const current = store.get(this.path) ?? {};
      applyUpdate(current, structuredClone(data));
      store.set(this.path, current);
    }
    async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
      const current = options?.merge ? store.get(this.path) ?? {} : {};
      applyUpdate(current, structuredClone(data));
      store.set(this.path, current);
    }
  }

  class FakeCollection {
    constructor(readonly path: string) {}
    doc(id: string) {
      return new FakeRef(`${this.path}/${id}`);
    }
  }

  const write = (operation: 'set' | 'update', reference: FakeRef, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    if (operation === 'set') return reference.set(data, options);
    return reference.update(data);
  };
  const firestore = {
    collection: (name: string) => new FakeCollection(name),
    batch: () => {
      const operations: Array<() => Promise<void>> = [];
      return {
        set: (reference: FakeRef, data: Record<string, unknown>, options?: { merge?: boolean }) => {
          operations.push(() => write('set', reference, data, options));
        },
        update: (reference: FakeRef, data: Record<string, unknown>) => {
          operations.push(() => write('update', reference, data));
        },
        commit: async () => { await Promise.all(operations.map((operation) => operation())); },
      };
    },
    runTransaction: async (work: (transaction: unknown) => Promise<unknown>) => work({
      get: (reference: FakeRef) => reference.get(),
      set: (reference: FakeRef, data: Record<string, unknown>, options?: { merge?: boolean }) => {
        void write('set', reference, data, options);
      },
      update: (reference: FakeRef, data: Record<string, unknown>) => {
        void write('update', reference, data);
      },
    }),
  };
  return {
    firestore: firestore as unknown as admin.firestore.Firestore,
    read: (path: string) => store.get(path),
  };
}

describe('Founding Artist communication delivery', () => {
  it('uses a stable idempotency key and advances an artist only after invitation delivery succeeds', async () => {
    const { firestore, read } = makeFirestore({
      'foundingArtistCommunications/invite-1': {
        type: 'beta_invitation', status: 'pending', recipientUid: 'artist-1',
        recipientEmail: 'artist@example.com', actionUrl: 'https://app.indii.music/', attempts: 0,
      },
      'foundingArtistWaitlist/artist-1': {
        email: 'artist@example.com', status: 'waitlisted', invitation: { status: 'queued' },
      },
    });
    const send = vi.fn().mockResolvedValue({ sent: true, messageId: 'resend-1' });

    await expect(deliverFoundingArtistInvitation('invite-1', firestore, send)).resolves.toBe('sent');

    expect(send).toHaveBeenCalledWith(
      'artist@example.com',
      'Your Founding Artist Beta access is ready',
      expect.stringContaining('Your access is ready'),
      expect.objectContaining({ idempotencyKey: 'founding-artist-invitation:invite-1' }),
    );
    expect(read('foundingArtistCommunications/invite-1')).toMatchObject({
      status: 'sent', providerMessageId: 'resend-1', attempts: 1,
    });
    expect(read('foundingArtistWaitlist/artist-1')).toMatchObject({
      status: 'invited', invitation: { status: 'sent', providerMessageId: 'resend-1' },
    });
    expect(read('foundingArtistEvents/invite-1_sent')).toMatchObject({
      uid: 'artist-1', type: 'invitation_sent', toStatus: 'invited',
    });
  });

  it('records a retryable failure without falsely marking the artist invited', async () => {
    const { firestore, read } = makeFirestore({
      'foundingArtistCommunications/invite-2': {
        type: 'beta_invitation', status: 'pending', recipientUid: 'artist-2',
        recipientEmail: 'artist@example.com', attempts: 0,
      },
      'foundingArtistWaitlist/artist-2': {
        email: 'artist@example.com', status: 'waitlisted', invitation: { status: 'queued' },
      },
    });
    const send = vi.fn().mockResolvedValue({ sent: false, reason: 'provider unavailable' });

    await expect(deliverFoundingArtistInvitation('invite-2', firestore, send)).rejects.toThrow('provider unavailable');
    expect(read('foundingArtistCommunications/invite-2')).toMatchObject({ status: 'failed', attempts: 1 });
    expect(read('foundingArtistWaitlist/artist-2')).toMatchObject({
      status: 'waitlisted', invitation: { status: 'queued', failureReason: 'provider unavailable' },
    });
  });

  it('clears a queued invitation when the artist is no longer eligible at delivery time', async () => {
    const { firestore, read } = makeFirestore({
      'foundingArtistCommunications/invite-3': {
        type: 'beta_invitation', status: 'pending', recipientUid: 'artist-3',
        recipientEmail: 'old@example.com', attempts: 0,
      },
      'foundingArtistWaitlist/artist-3': {
        email: 'new@example.com', status: 'waitlisted', invitation: { status: 'queued' },
      },
    });
    const send = vi.fn();

    await expect(deliverFoundingArtistInvitation('invite-3', firestore, send)).resolves.toBe('skipped');
    expect(send).not.toHaveBeenCalled();
    expect(read('foundingArtistWaitlist/artist-3')).toMatchObject({
      status: 'waitlisted',
      invitation: { status: 'failed', failureReason: expect.stringContaining('no longer eligible') },
    });
  });

  it('does not send a stale queued invitation after the artist lifecycle advances', async () => {
    const { firestore, read } = makeFirestore({
      'foundingArtistCommunications/invite-4': {
        type: 'beta_invitation', status: 'pending', recipientUid: 'artist-4',
        recipientEmail: 'artist@example.com', attempts: 0,
      },
      'foundingArtistWaitlist/artist-4': {
        email: 'artist@example.com', status: 'accepted', invitation: { status: 'queued' },
      },
    });
    const send = vi.fn();

    await expect(deliverFoundingArtistInvitation('invite-4', firestore, send)).resolves.toBe('skipped');
    expect(send).not.toHaveBeenCalled();
    expect(read('foundingArtistCommunications/invite-4')).toMatchObject({ status: 'skipped' });
    expect(read('foundingArtistWaitlist/artist-4')).toMatchObject({
      status: 'accepted',
      invitation: { status: 'failed' },
    });
  });

  it('rechecks milestone consent at delivery, escapes admin text, and audits each result', async () => {
    const campaignId = 'ef58860e-5177-4a8d-a461-21d05221b87d';
    const { firestore, read } = makeFirestore({
      [`foundingArtistCampaigns/${campaignId}`]: {
        type: 'major_milestone', status: 'pending', subject: 'Major <launch>',
        message: '<script>not html</script>', recipientUids: ['artist-1', 'artist-2'],
      },
      'foundingArtistWaitlist/artist-1': {
        email: 'one@example.com', emailVerified: true, status: 'waitlisted',
        communicationPreferences: { majorMilestoneUpdates: true },
      },
      'foundingArtistWaitlist/artist-2': {
        email: 'two@example.com', emailVerified: true, status: 'waitlisted',
        communicationPreferences: { majorMilestoneUpdates: false },
      },
    });
    const send = vi.fn().mockResolvedValue({ sent: true, messageId: 'resend-milestone' });

    await expect(deliverFoundingArtistMilestoneCampaign(campaignId, firestore, send)).resolves.toEqual({
      sent: 1, skipped: 1, failed: 0,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toContain('&lt;script&gt;not html&lt;/script&gt;');
    expect(send.mock.calls[0][2]).not.toContain('<script>');
    expect(send.mock.calls[0][2]).toContain('https://indii.music/?manageUpdates=true#waitlist');
    expect(send.mock.calls[0][3].text).toContain('https://indii.music/?manageUpdates=true#waitlist');
    expect(send.mock.calls[0][3]).toMatchObject({
      idempotencyKey: `founding-artist-milestone:${campaignId}:artist-1`,
    });
    expect(read(`foundingArtistCampaigns/${campaignId}/deliveries/artist-1`)).toMatchObject({ status: 'sent' });
    expect(read(`foundingArtistCampaigns/${campaignId}/deliveries/artist-2`)).toMatchObject({ status: 'skipped' });
    expect(read(`foundingArtistCampaigns/${campaignId}`)).toMatchObject({
      status: 'completed', summary: { sent: 1, skipped: 1, failed: 0 },
    });
  });
});
