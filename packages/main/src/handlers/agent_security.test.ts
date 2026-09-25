import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerAgentHandlers } from './agent';

// Define hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    app: {
        isPackaged: false,
        getPath: vi.fn(() => '/mock/user-data'),
        getAppPath: vi.fn(() => '/app')
    },
    webExtractionService: {
        extract: vi.fn().mockResolvedValue({
            finalUrl: 'https://google.com/',
            title: 'Mock Page',
            text: 'Mock text',
            fetchedAt: '2026-01-01T00:00:00.000Z',
        }),
    }
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));

// Mock 'electron-store' to prevent filesystem access in CI
vi.mock('electron-store', () => ({
    default: class MockStore {
        store: Record<string, unknown> = {};
        path = '/mock/store.json';
        get(key: string) { return this.store[key]; }
        set(key: string, val: unknown) { this.store[key] = val; }
        delete(key: string) { delete this.store[key]; }
        clear() { this.store = {}; }
    }
}));

// Mock 'BrowserAgentService'
vi.mock('../services/WebExtractionService', () => ({
    webExtractionService: mocks.webExtractionService
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

// Typed result for IPC handler responses
interface HandlerResult {
    success: boolean;
    error?: string;
    data?: unknown;
}

describe('🛡️ Shield: Agent IPC Security Test', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        // Prevent ZodError formatting crash in Vitest's console serializer
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        handlers = {};
        mocks.app.isPackaged = false;

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });

        // Register handlers
        registerAgentHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    const invokeHandler = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK extraction from Localhost (SSRF)', async () => {
        const result = await invokeHandler('agent:extract-web-page', 'http://localhost:3000');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
        expect(mocks.webExtractionService.extract).not.toHaveBeenCalled();
    });

    it('should BLOCK extraction from Private IPs (127.0.0.1)', async () => {
        const result = await invokeHandler('agent:extract-web-page', 'http://127.0.0.1/admin');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });

    it('should BLOCK extraction from Cloud Metadata (AWS)', async () => {
        const result = await invokeHandler('agent:extract-web-page', 'http://169.254.169.254/latest/meta-data/');

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });

    it('should ALLOW extraction from Safe Public Domains', async () => {
        const result = await invokeHandler('agent:extract-web-page', 'https://google.com');

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            finalUrl: 'https://google.com/',
            title: 'Mock Page',
            text: 'Mock text',
        });
        expect(mocks.webExtractionService.extract).toHaveBeenCalledWith('https://google.com');
    });

    it('should BLOCK malicious protocols (file://)', async () => {
        // FetchUrlSchema validates this before validateSafeUrlAsync, but let's check
        const result = await invokeHandler('agent:extract-web-page', 'file:///etc/passwd');

        expect(result.success).toBe(false);
        // This comes from Zod validation (FetchUrlSchema)
        expect(result.error).toMatch(/Validation Error: Invalid URL: Must be a public HTTP\/HTTPS URL. Local\/Private IPs are blocked./);
    });

    it('registers read-only web extraction in packaged builds and omits browser input handlers', () => {
        mocks.app.isPackaged = true;
        const packagedHandlers: Record<string, (...args: unknown[]) => unknown> = {};
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            packagedHandlers[channel] = handler;
        });

        registerAgentHandlers();

        expect(packagedHandlers['agent:extract-web-page']).toBeDefined();
        expect(packagedHandlers['agent:navigate-and-extract']).toBeUndefined();
        expect(packagedHandlers['agent:perform-action']).toBeUndefined();
        expect(packagedHandlers['agent:capture-state']).toBeUndefined();
        expect(packagedHandlers['test:browser-agent']).toBeUndefined();
    });
});
