import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatFoundryService } from '../services/FormatFoundryService';
import { accessControlService } from '../security/AccessControlService';

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../security/AccessControlService', () => ({
  accessControlService: {
    verifyAccess: vi.fn(),
    grantAccess: vi.fn(),
  },
}));

describe('FormatFoundryService Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies file read when path is unauthorized', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

    const result = await formatFoundryService.readTextFile('/etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('denies metadata check when path is unauthorized', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

    const result = await formatFoundryService.getFileMetadata('/private/var/keys');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });
});
