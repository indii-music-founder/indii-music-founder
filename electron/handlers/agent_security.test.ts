import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAgentHandlers } from './agent';

// Define hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    app: {
        isPackaged: false,
        getPath: vi.fn(() => '/mock/user-data')
    },
    browserAgentService: {
        startSession: vi.fn(),
        navigateTo: vi.fn(),
        typeInto: vi.fn(),
        pressKey: vi.fn(),
        waitForSelector: vi.fn(),
        captureSnapshot: vi.fn().mockResolvedValue({ title: 'Mock Page', url: 'https://google.com' }),
        closeSession: vi.fn(),
        performAction: vi.fn()
    }
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));

// Mock 'BrowserAgentService'
vi.mock('../services/BrowserAgentService', () => ({
    browserAgentService: mocks.browserAgentService
}));

// Mock 'node:dns' to simulate DNS resolution for security testing
vi.mock('node:dns', async () => {
    return {
        default: {
            promises: {
                lookup: vi.fn(async (hostname: string) => {
                    if (hostname === 'localhost') return [{ address: '127.0.0.1' }];
                    if (hostname === 'internal.corp') return [{ address: '10.0.0.5' }];
                    if (hostname === 'metadata.aws') return [{ address: '169.254.169.254' }];
                    if (hostname === 'google.com') return [{ address: '8.8.8.8' }];
                    return [{ address: '1.1.1.1' }];
                })
            }
        },
        promises: {
            lookup: vi.fn(async (hostname: string) => {
                if (hostname === 'localhost') return [{ address: '127.0.0.1' }];
                if (hostname === 'internal.corp') return [{ address: '10.0.0.5' }];
                if (hostname === 'metadata.aws') return [{ address: '169.254.169.254' }];
                if (hostname === 'google.com') return [{ address: '8.8.8.8' }];
                return [{ address: '1.1.1.1' }];
            })
        }
    };
});

describe('🛡️ Shield: Agent IPC Security Test', () => {
    let handlers: Record<string, (...args: any[]) => any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
            handlers[channel] = handler;
        });

        // Register handlers
        registerAgentHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    const invokeHandler = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    it('should BLOCK navigation to Localhost (SSRF)', async () => {
        const result = await invokeHandler('agent:navigate-and-extract', 'http://localhost:3000');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
        expect(mocks.browserAgentService.navigateTo).not.toHaveBeenCalled();
    });

    it('should BLOCK navigation to Private IPs (127.0.0.1)', async () => {
        const result = await invokeHandler('agent:navigate-and-extract', 'http://127.0.0.1/admin');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });

    it('should BLOCK navigation to Cloud Metadata (AWS)', async () => {
        const result = await invokeHandler('agent:navigate-and-extract', 'http://169.254.169.254/latest/meta-data/');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });

    it('should BLOCK navigation to Domains resolving to Private IPs (DNS Rebinding)', async () => {
        // internal.corp mocks to 10.0.0.5
        const result = await invokeHandler('agent:navigate-and-extract', 'http://internal.corp/secret');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Domain 'internal.corp' resolves to private IP 10.0.0.5/);
    });

    it('should ALLOW navigation to Safe Public Domains', async () => {
        const result = await invokeHandler('agent:navigate-and-extract', 'https://google.com');

        expect(result.success).toBe(true);
        expect(mocks.browserAgentService.navigateTo).toHaveBeenCalledWith('https://google.com');
    });

    it('should BLOCK malicious protocols (file://)', async () => {
        // FetchUrlSchema validates this before validateSafeUrlAsync, but let's check
        const result = await invokeHandler('agent:navigate-and-extract', 'file:///etc/passwd');

        expect(result.success).toBe(false);
        // This comes from Zod validation (FetchUrlSchema)
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });
});
