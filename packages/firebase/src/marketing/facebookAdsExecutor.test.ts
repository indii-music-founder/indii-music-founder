import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { pushAdCreative } from './facebookAdsExecutor';

const mockGet = vi.fn();
const mockAdd = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: vi.fn((collName: string) => {
      if (collName === 'users') {
        return {
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                get: mockGet,
              })),
            })),
          })),
        };
      }
      if (collName === 'timelineExecutionLogs') {
        return {
          add: mockAdd,
        };
      }
      return {};
    }),
  }),
}));

vi.mock('axios');

describe('facebookAdsExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if Meta analytics account doc does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await pushAdCreative('user123', 'act_100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('User has not connected a Meta account');
  });

  it('fails if Page ID is missing', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ accessToken: 'mock_token' }),
    });

    const result = await pushAdCreative('user123', '100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Meta Page ID is missing');
  });

  it('successfully uploads asset, creates ad creative, and logs audit trail', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ accessToken: 'mock_token', pageId: 'page_999' }),
    });

    vi.mocked(axios.post)
      .mockResolvedValueOnce({
        data: {
          images: {
            'cover.jpg': { hash: 'hash_abc123' },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'creative_45678',
        },
      });

    mockAdd.mockResolvedValueOnce({ id: 'log_001' });

    const result = await pushAdCreative('user123', 'act_100', {
      name: 'Summer Single Ad',
      body: 'Listen now!',
      imageUrl: 'https://example.com/cover.jpg',
      linkUrl: 'https://spotify.com',
    });

    expect(result.success).toBe(true);
    expect(result.creativeId).toBe('creative_45678');
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'fb_ad_creative_pushed',
        creativeId: 'creative_45678',
        status: 'success',
      })
    );
  });
});
