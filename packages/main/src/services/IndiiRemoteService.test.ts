import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// First, we must mock the dependencies before importing the service
vi.mock('express', () => {
    const expressMock = vi.fn(() => ({
        use: vi.fn(),
        post: vi.fn(),
    }));
    // attach static/json methods to the default export
    (expressMock as any).json = vi.fn();
    (expressMock as any).static = vi.fn();
    return {
        default: expressMock,
    };
});

vi.mock('http', () => {
    return {
        createServer: vi.fn(() => ({
            listen: vi.fn((port, host, cb) => {
                if (cb) cb();
            }),
            close: vi.fn(),
        })),
        // Providing a default export as requested by Vitest
        default: {
            createServer: vi.fn(() => ({
                listen: vi.fn((port, host, cb) => {
                    if (cb) cb();
                }),
                close: vi.fn(),
            })),
        }
    };
});

vi.mock('ws', () => {
    const WebSocketServer = class {
        on = vi.fn();
        close = vi.fn();
    };
    return {
        WebSocketServer,
        WebSocket: vi.fn(),
        default: {
            WebSocketServer,
            WebSocket: vi.fn()
        }
    };
});

vi.mock('@ngrok/ngrok', () => {
    return {
        default: {
            connect: vi.fn().mockResolvedValue({
                url: () => 'https://mock-ngrok-url.com',
            }),
            disconnect: vi.fn(),
        },
    };
});

vi.mock('electron', () => {
    return {
        app: {
            getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
            isReady: vi.fn().mockReturnValue(true),
        },
        BrowserWindow: {
            getAllWindows: vi.fn().mockReturnValue([]),
        },
        default: {
            app: {
                getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
                isReady: vi.fn().mockReturnValue(true),
            },
            BrowserWindow: {
                getAllWindows: vi.fn().mockReturnValue([]),
            },
        }
    };
});

// Import after mocking
import { indiiRemoteService, IndiiRemoteError } from './IndiiRemoteService';

describe('IndiiRemoteService', () => {
    // Reset service state before each test
    beforeEach(async () => {
        // Clear any existing mock implementations
        vi.clearAllMocks();

        // Try to stop the service cleanly if it was running
        try {
            await indiiRemoteService.stop();
        } catch (_e) {
            // Ignore stop errors during cleanup
        }
    });

    afterEach(() => {
    });

    describe('startup validation', () => {
        it('should fail closed when starting without a password', async () => {
            // Assert that calling start without a password throws an error
            await expect(indiiRemoteService.start({} as any)).rejects.toThrowError(IndiiRemoteError);

            try {
                await indiiRemoteService.start({} as any);
                expect.fail('Should have thrown');
            } catch (error: any) {
                expect(error.code).toBe('INVALID_CONFIG');
            }

            // Verify state is not modified
            expect(indiiRemoteService.getStatus().isRunning).toBe(false);
        });

        it('should fail closed when starting with an empty password', async () => {
            await expect(indiiRemoteService.start({ password: '' })).rejects.toThrowError(IndiiRemoteError);
            await expect(indiiRemoteService.start({ password: '   ' })).rejects.toThrowError(IndiiRemoteError);

            // Verify state is not modified
            expect(indiiRemoteService.getStatus().isRunning).toBe(false);
        });
    });

    describe('concurrent startups', () => {
        it('should implement a mutex to prevent multiple concurrent _doStart calls', async () => {
            // We need to spy on the private _doStart method. Since it's private, we can use any
            const doStartSpy = vi.spyOn(indiiRemoteService as any, '_doStart');

            // Initiate two start calls concurrently
            const config = { password: 'valid-password' };
            const promise1 = indiiRemoteService.start(config);
            const promise2 = indiiRemoteService.start(config);

            // Both promises should resolve to the same value
            const [result1, result2] = await Promise.all([promise1, promise2]);

            expect(result1).toBe(result2);
            // Verify _doStart was only called once despite two start() calls
            expect(doStartSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('successful start', () => {
        it('should start successfully with a valid password', async () => {
            const config = { password: 'valid-password' };
            const url = await indiiRemoteService.start(config);

            expect(url).toContain('http://');
            expect(indiiRemoteService.getStatus().isRunning).toBe(true);
        });

        it('should return existing url if already running', async () => {
            const config = { password: 'valid-password' };
            const url1 = await indiiRemoteService.start(config);
            const url2 = await indiiRemoteService.start(config);

            expect(url1).toBe(url2);
            expect(indiiRemoteService.getStatus().isRunning).toBe(true);
        });
    });
});
