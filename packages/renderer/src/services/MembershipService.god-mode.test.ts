import { describe, it, expect, beforeEach, vi } from 'vitest';
import MembershipService from './MembershipService';

// Mock Firebase auth
vi.mock('@/services/firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
}));

describe('MembershipService - God Mode Bypass', () => {
  let service: typeof MembershipService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = require('./MembershipService').default;
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

    vi.mocked(require('@/core/store')).useStore.mockReturnValue({
      authUser: mockUser,
      userProfile: { id: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1', email: 'test@example.com' },
      organizations: [],
      currentOrganizationId: null,
    });

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

    vi.mocked(require('@/core/store')).useStore.mockReturnValue({
      authUser: mockUser,
      userProfile: { id: 'other-user-id', email: 'other@example.com' },
      organizations: [{ id: 'org-1', plan: 'free' as const }],
      currentOrganizationId: 'org-1',
    });

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

    vi.mocked(require('@/core/store')).useStore.mockReturnValue({
      authUser: mockUser,
      userProfile: { id: '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1', email: 'test@example.com' },
      organizations: [],
      currentOrganizationId: null,
    });

    const result = await service.checkQuota('image', 1000);
    expect(result.allowed).toBe(true);
    expect(result.maxAllowed).toBe(Infinity);
  });
});
