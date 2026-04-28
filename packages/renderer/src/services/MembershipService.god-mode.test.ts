import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MembershipService } from '@/services/MembershipService';

// Mock Firebase auth
vi.mock('@/services/firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
}));
import { auth } from '@/services/firebase';

import { useStore } from '@/core/store';
vi.mock('@/core/store', () => ({
  useStore: vi.fn(),
}));

describe('MembershipService - God Mode Bypass', () => {
  let service: typeof MembershipService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = MembershipService;
  });

  it('should grant enterprise tier when god_mode claim is true', async () => {
    // Mock a user with god_mode claim
    const mockIdTokenResult = {
      claims: {
        god_mode: true,
      },
    };

    const mockUser = {
      uid: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1',
      getIdTokenResult: vi.fn().mockResolvedValue(mockIdTokenResult),
    };
    (auth as any).currentUser = mockUser;

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
      userProfile: { id: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1', email: 'test@example.com' },
      organizations: [],
      currentOrganizationId: null,
    } as any);

    const tier = await service.getCurrentTier();
    expect(tier).toBe('enterprise');
    expect(mockUser.getIdTokenResult).toHaveBeenCalled();
  });

  it('should deny god_mode when claim is missing', async () => {
    const mockIdTokenResult = {
      claims: {}, // god_mode not set
    };

    const mockUser = {
      uid: 'other-user-id',
      getIdTokenResult: vi.fn().mockResolvedValue(mockIdTokenResult),
    };
    (auth as any).currentUser = mockUser;

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
      userProfile: { id: 'other-user-id', email: 'other@example.com' },
      organizations: [{ id: 'org-1', plan: 'free' as const }],
      currentOrganizationId: 'org-1',
    } as any);

    const tier = await service.getCurrentTier();
    expect(tier).toBe('free');
  });

  it('should allow unlimited quota when god_mode claim is true', async () => {
    const mockIdTokenResult = {
      claims: {
        god_mode: true,
      },
    };

    const mockUser = {
      uid: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1',
      getIdTokenResult: vi.fn().mockResolvedValue(mockIdTokenResult),
    };
    (auth as any).currentUser = mockUser;

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
      userProfile: { id: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1', email: 'test@example.com' },
      organizations: [],
      currentOrganizationId: null,
    } as any);

    const result = await service.checkQuota('image', 1000);
    expect(result.allowed).toBe(true);
    expect(result.maxAllowed).toBe(Infinity);
  });
});
