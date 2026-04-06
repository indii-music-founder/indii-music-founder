import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerNetworkHandlers } from './network';

// --- Mocks ---

// Hoisted container for dynamic mock behavior
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    dns: {
        lookup: vi.fn()
    }
}));

// Mock Electron
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        isPackaged: false,
        getAppPath: () => '/app'
    }
}));

// Mock Node DNS
vi.mock('node:dns', () => ({
    default: {
        promises: {
            lookup: mocks.dns.lookup
        }
    },
    promises: {
        lookup: mocks.dns.lookup
    }
}));

// Mock Global Fetch
global.fetch = vi.fn();

describe('🛡️ Shield: Network IPC Security (SSRF & Fuzzing)', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture IPC handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });

        // Register the network handlers
        registerNetworkHandlers();

        // Default DNS behavior: Resolve anything to a public IP (1.1.1.1) unless specified
        mocks.dns.lookup.mockImplementation(async (hostname: string) => {
            if (hostname === 'localhost') return [{ address: '127.0.0.1', family: 4 }];
            if (hostname === 'evil-internal.com') return [{ address: '192.168.1.5', family: 4 }];
            if (hostname === 'metadata.aws') return [{ address: '169.254.169.254', family: 4 }];
            return [{ address: '1.1.1.1', family: 4 }];
        });

        // Default fetch behavior: Success
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            text: async () => 'Safe Content'
        });
    });

    const invokeHandler = async (channel: string, ...args: unknown[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        // Simulate Electron event with a sender frame
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    describe('IPC Fuzzer (Input Validation)', () => {
        it('should REJECT null input', async () => {
            await expect(invokeHandler('net:fetch-url', null))
                .rejects.toThrow(/Validation failed|Invalid URL/);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should REJECT undefined input', async () => {
            await expect(invokeHandler('net:fetch-url', undefined))
                .rejects.toThrow(/Validation failed|Invalid URL/);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should REJECT object input', async () => {
            await expect(invokeHandler('net:fetch-url', { dangerous: true }))
                .rejects.toThrow(/Validation failed|Invalid URL/);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should REJECT empty string', async () => {
            await expect(invokeHandler('net:fetch-url', ''))
                .rejects.toThrow(/Validation failed|Invalid URL/);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should REJECT huge string (Buffer Overflow attempt)', async () => {
             // Zod's .url() will fail this, but we want to ensure it doesn't crash
            const hugeString = 'A'.repeat(100000);
            await expect(invokeHandler('net:fetch-url', hugeString))
                .rejects.toThrow(/Validation failed|Invalid URL/);
        });
    });

    describe('SSRF Prevention (Sandbox Escape)', () => {
        it('should BLOCK localhost access', async () => {
            // Blocked by Zod Schema (Layer 1)
            await expect(invokeHandler('net:fetch-url', 'http://localhost:8080/admin'))
                .rejects.toThrow(/Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should BLOCK 127.0.0.1 access', async () => {
            // Blocked by Zod Schema (Layer 1)
            await expect(invokeHandler('net:fetch-url', 'http://127.0.0.1/secrets'))
                .rejects.toThrow(/Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should BLOCK Cloud Metadata (AWS)', async () => {
            // Blocked by Zod Schema (Layer 1)
            await expect(invokeHandler('net:fetch-url', 'http://169.254.169.254/latest/meta-data'))
                .rejects.toThrow(/Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should BLOCK DNS Rebinding (Public Domain -> Private IP)', async () => {
            // 'evil-internal.com' is mocked to resolve to 192.168.1.5
            await expect(invokeHandler('net:fetch-url', 'http://evil-internal.com/router-config'))
                .rejects.toThrow(/Security Violation: Domain 'evil-internal.com' resolves to private IP 192.168.1.5/);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should ALLOW safe public domains', async () => {
            const result = await invokeHandler('net:fetch-url', 'https://example.com/api/data');

            expect(result).toBe('Safe Content');
            expect(global.fetch).toHaveBeenCalledWith('https://example.com/api/data', expect.objectContaining({ redirect: 'error' }));
        });
    });

    describe('Protocol Guard', () => {
        it('should BLOCK file:// protocol (Path Traversal)', async () => {
            await expect(invokeHandler('net:fetch-url', 'file:///etc/passwd'))
                .rejects.toThrow(/Validation failed|Invalid URL/); // Zod catches this first usually
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should BLOCK ftp:// protocol', async () => {
            await expect(invokeHandler('net:fetch-url', 'ftp://example.com/file'))
                .rejects.toThrow(/Validation failed|Invalid URL/);
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });
});
