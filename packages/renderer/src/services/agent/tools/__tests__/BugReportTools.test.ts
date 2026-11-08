import { describe, it, expect, vi, beforeEach } from 'vitest';

const { judgeInvoke, httpsCallableMock, toastMock, mockFirestoreAdd } = vi.hoisted(() => ({
  judgeInvoke: vi.fn(),
  httpsCallableMock: vi.fn(),
  toastMock: { warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn() },
  mockFirestoreAdd: vi.fn().mockResolvedValue('doc-123'),
}));

vi.mock('@/services/FirestoreService', () => ({
  FirestoreService: class {
    add = mockFirestoreAdd;
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock('@/services/firebase', () => ({
  functions: {},
}));

vi.mock('@/core/context/ToastContext', () => ({
  toast: toastMock,
}));

vi.mock('@/utils/dynamicImport', () => ({
  importWithRetry: (loader: () => Promise<unknown>) => loader(),
}));

vi.mock('@/core/store', () => ({
  useStore: {
    getState: () => ({
      currentModule: 'dashboard',
      currentProjectId: 'proj-1',
      currentOrganizationId: 'org-1',
    }),
  },
}));

vi.mock('@/services/agent/memory/AlwaysOnMemoryEngine', () => ({
  alwaysOnMemoryEngine: {
    ingest: vi.fn().mockResolvedValue(undefined),
  },
}));

import { BugReportTools } from '../BugReportTools';

describe('BugReportTools.report_bug honesty gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpsCallableMock.mockReturnValue(judgeInvoke);
  });

  const args = {
    title: 'Silent resolution downscaling in Creative Studio',
    description: 'Output is 1024x1024 despite a 3000x3000 request.',
    severity: 'major',
    module: 'Creative Studio',
  };

  it('files through reportBugFn and reports success only when Firestore persisted', async () => {
    judgeInvoke.mockResolvedValue({
      data: { firestore: 'ok', github: 'ok', issueUrl: 'https://x/issues/1', message: 'created' },
    });

    const result = await BugReportTools.report_bug!(args);

    expect(result.success).toBe(true);
    expect(judgeInvoke).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Silent resolution downscaling in Creative Studio',
      module: 'Creative Studio',
      severity: 'major',
    }));
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
  });

  it('returns toolError when the pipeline is unreachable — never fake success', async () => {
    judgeInvoke.mockRejectedValue(new Error('unavailable'));

    const result = await BugReportTools.report_bug!(args);

    expect(result.success).toBe(false);
    expect(result.error).toContain('NOT filed');
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('could NOT be filed'));
  });

  it('returns toolError when the server cannot persist, even with a structured response', async () => {
    judgeInvoke.mockResolvedValue({
      data: { firestore: 'failed', github: 'skipped', message: 'firestore down' },
    });

    const result = await BugReportTools.report_bug!(args);

    expect(result.success).toBe(false);
    expect(result.error).toContain('NOT filed');
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('stays loud when GitHub sync fails after a durable save', async () => {
    judgeInvoke.mockResolvedValue({
      data: { firestore: 'ok', github: 'skipped', message: 'saved locally' },
    });

    const result = await BugReportTools.report_bug!(args);

    expect(result.success).toBe(true);
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('GitHub issue sync failed'));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('rejects reports missing title or description', async () => {
    const result = await BugReportTools.report_bug!({ title: '', description: '' });

    expect(result.success).toBe(false);
    expect(judgeInvoke).not.toHaveBeenCalled();
  });
});

describe('BugReportTools.request_feature honesty gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const featureArgs = {
    title: 'Batch stems export',
    description: 'Export all stems with 24-bit 48kHz WAV options.',
    priority: 'high' as const,
    module: 'Mastering',
  };

  it('persists to Firestore and returns success', async () => {
    mockFirestoreAdd.mockResolvedValueOnce('feat-doc-1');

    const result = await BugReportTools.request_feature!(featureArgs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Saved to your feedback tracker');
    expect(mockFirestoreAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Batch stems export',
      priority: 'high',
      module: 'Mastering',
    }));
  });

  it('returns toolError when Firestore persistence fails, never fake success', async () => {
    mockFirestoreAdd.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

    const result = await BugReportTools.request_feature!(featureArgs);

    expect(result.success).toBe(false);
    expect(result.metadata?.errorCode).toBe('FEATURE_REQUEST_PERSISTENCE_FAILED');
    expect(result.error).toContain('Failed to record feature request in feedback tracker');
  });
});
