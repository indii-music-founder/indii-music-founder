import { vi, beforeEach } from 'vitest';

// Mock keytar globally to prevent libsecret-1.so.0 ERR_DLOPEN_FAILED on headless Linux CI
vi.mock('keytar', () => ({
    default: {
        setPassword: vi.fn().mockResolvedValue(undefined),
        getPassword: vi.fn().mockResolvedValue(null),
        deletePassword: vi.fn().mockResolvedValue(true),
        findPassword: vi.fn().mockResolvedValue(null),
        findCredentials: vi.fn().mockResolvedValue([]),
    },
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(null),
    deletePassword: vi.fn().mockResolvedValue(true),
    findPassword: vi.fn().mockResolvedValue(null),
    findCredentials: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
    vi.useRealTimers();
});
