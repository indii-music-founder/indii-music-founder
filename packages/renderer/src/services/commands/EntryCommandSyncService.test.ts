import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeState = vi.hoisted(() => ({
  currentOrganizationId: 'org-1',
}));

const firestoreMocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  doc: vi.fn((_db: unknown, ...parts: string[]) => ({ path: parts.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

vi.mock('@/core/store', () => ({
  useStore: {
    getState: () => storeState,
  },
}));

vi.mock('@/services/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: { app: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => firestoreMocks.collection(...(args as [unknown, ...string[]])),
  doc: (...args: unknown[]) => firestoreMocks.doc(...(args as [unknown, ...string[]])),
  getDocs: (ref: unknown) => firestoreMocks.getDocs(ref),
  query: (ref: unknown, ...constraints: unknown[]) => firestoreMocks.query(ref, ...constraints),
  setDoc: (ref: unknown, data: unknown, options?: unknown) => firestoreMocks.setDoc(ref, data, options),
  where: (...args: unknown[]) => firestoreMocks.where(...(args as [string, string, unknown])),
}));

import { clearCustomEntryCommands, resolveEntryCommand } from './EntryCommandRegistry';
import { entryCommandSyncService } from './EntryCommandSyncService';

describe('EntryCommandSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCustomEntryCommands();
    storeState.currentOrganizationId = 'org-1';
    firestoreMocks.getDocs.mockResolvedValue({
      forEach: vi.fn(),
    });
  });

  it('mirrors custom commands to user and team Firestore scopes', async () => {
    const result = await entryCommandSyncService.saveCustomCommand({
      id: 'custom-shirt',
      slash: '/shirt',
      aliases: [],
      title: 'Shirt',
      summary: 'Shared shirt workflow.',
      surfaces: ['command-bar', 'mobile', 'voice'],
      harnessDomain: 'merch_pod',
      launchMode: 'guided-chat',
      intakeFields: [],
      outputContract: 'Merch workflow.',
      approvalRequiredFor: ['paid checkout'],
      resumeBehavior: 'Resume shirt workflow.',
      isCustom: true,
    }, { scope: 'team' });

    expect(result.ok).toBe(true);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'entryCommands/user-1_custom-shirt' },
      expect.objectContaining({ slash: '/shirt', scope: 'user', ownerId: 'user-1' }),
      { merge: true }
    );
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { path: 'teamEntryCommands/org-1_custom-shirt' },
      expect.objectContaining({ slash: '/shirt', scope: 'team', orgId: 'org-1' }),
      { merge: true }
    );
  });

  it('hydrates cloud commands into the local registry', async () => {
    firestoreMocks.getDocs
      .mockResolvedValueOnce({
        forEach: (callback: (snapshot: { data: () => unknown }) => void) => callback({
          data: () => ({
            id: 'custom-contact',
            slash: '/street-contact',
            aliases: [],
            title: 'Street Contact',
            summary: 'Capture people met in the field.',
            surfaces: ['command-bar', 'mobile'],
            intakeFields: [],
            harnessDomain: 'fan_crm',
            launchMode: 'guided-chat',
            outputContract: 'Contact capture workflow.',
            approvalRequiredFor: ['SMS send'],
            resumeBehavior: 'Resume contact capture.',
            isCustom: true,
            ownerId: 'user-1',
            scope: 'user',
            updatedAt: Date.now(),
          }),
        }),
      })
      .mockResolvedValueOnce({
        forEach: vi.fn(),
      });

    await entryCommandSyncService.hydrateCustomCommands({ orgId: 'org-2' });

    expect(resolveEntryCommand('/street-contact Marcus'))?.toMatchObject({
      id: 'custom-contact',
      harnessDomain: 'fan_crm',
      isCustom: true,
    });
  });
});
