import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerWeb3Handlers, ethereumNetworkWrapper } from './web3';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn(),
    },
    dns: {
        lookup: vi.fn(),
    },
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        isPackaged: false,
        getAppPath: () => '/app',
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

vi.mock('node:dns', () => ({
    default: {
        promises: {
            lookup: mocks.dns.lookup,
        },
    },
    promises: {
        lookup: mocks.dns.lookup,
    },
}));

describe('Web3 IPC Handlers & SSRF Protection', () => {
    let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
            handlers[channel] = handler;
        });

        registerWeb3Handlers();
    });

    it('registers all required web3 IPC endpoints', () => {
        expect(handlers['web3:set-rpc-url']).toBeDefined();
        expect(handlers['web3:get-provider-metadata']).toBeDefined();
        expect(handlers['web3:execute-transaction']).toBeDefined();
        expect(handlers['web3:get-balance']).toBeDefined();
    });

    it('web3:set-rpc-url rejects loopback and private IP endpoints', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:set-rpc-url'](mockEvent, 'http://127.0.0.1:8545') as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security Violation: Access to localhost is denied');
    });

    it('web3:set-rpc-url rejects cloud metadata endpoint', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:set-rpc-url'](mockEvent, 'http://169.254.169.254/latest/meta-data') as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security Violation: Access to Cloud Metadata services is denied');
    });

    it('web3:set-rpc-url rejects disallowed protocols', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:set-rpc-url'](mockEvent, 'ws://mainnet.infura.io/v3/test') as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Security Violation');
    });

    it('web3:set-rpc-url allows clearing RPC URL with null', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:set-rpc-url'](mockEvent, null) as { success: boolean; error?: string };

        expect(result.success).toBe(true);
        const meta = await handlers['web3:get-provider-metadata'](mockEvent) as { isSimulated: boolean; rpcUrl: string | null };
        expect(meta.isSimulated).toBe(true);
        expect(meta.rpcUrl).toBeNull();
    });

    it('web3:set-rpc-url accepts valid public HTTPS RPC endpoints', async () => {
        mocks.dns.lookup.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
        const mockEvent = { sender: {} };
        const result = await handlers['web3:set-rpc-url'](mockEvent, 'https://rpc.ankr.com/eth') as { success: boolean; error?: string };

        expect(result.success).toBe(true);
    });

    it('web3:get-balance validates ethereum address format', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:get-balance'](mockEvent, 'invalid-eth-address') as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid Ethereum address format');
    });

    it('web3:execute-transaction rejects payloads without a target address', async () => {
        const mockEvent = { sender: {} };
        const result = await handlers['web3:execute-transaction'](mockEvent, {
            from: '0x1111111111111111111111111111111111111111',
            to: '',
            value: '0x0',
        }) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Transaction requires a target address');
    });
});
