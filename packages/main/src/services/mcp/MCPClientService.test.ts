import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
    return {
        Client: vi.fn().mockImplementation(function() {
            return {
                connect: vi.fn().mockResolvedValue(undefined),
                callTool: vi.fn().mockResolvedValue({
                    content: [{ type: 'text', text: 'mocked response' }]
                })
            };
        })
    };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
    return {
        StdioClientTransport: vi.fn().mockImplementation(function() {
            return {
                close: vi.fn().mockResolvedValue(undefined)
            };
        })
    };
});

describe('MCPClientService', () => {
    let service: InstanceType<typeof import('./MCPClientService').MCPClientService>;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = mkdtempSync(path.join(tmpdir(), 'indii-mcp-test-'));
        const localServerPath = path.join(tempDir, 'local-index.js');
        const harnessServerPath = path.join(tempDir, 'harness-index.js');
        writeFileSync(localServerPath, '');
        writeFileSync(harnessServerPath, '');
        process.env.INDII_LOCAL_MCP_SERVER_PATH = localServerPath;
        process.env.INDII_HARNESS_MCP_SERVER_PATH = harnessServerPath;

        vi.clearAllMocks();
        const { MCPClientService } = await import('./MCPClientService');
        service = new MCPClientService();
    });

    afterEach(async () => {
        await service.disconnect();
        delete process.env.INDII_LOCAL_MCP_SERVER_PATH;
        delete process.env.INDII_HARNESS_MCP_SERVER_PATH;
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('should connect successfully', async () => {
        await service.connectLocal();

        // Assert that the client was instantiated for both local and harness servers
        expect(Client).toHaveBeenCalledTimes(2);
    });

    it('should skip local connection when the MCP server build is missing', async () => {
        process.env.INDII_LOCAL_MCP_SERVER_PATH = path.join(tempDir, 'missing-local-index.js');

        const connected = await service.connectLocal();

        expect(connected).toBe(false);
        expect(Client).not.toHaveBeenCalled();
        expect(StdioClientTransport).not.toHaveBeenCalled();
    });

    it('should disconnect successfully', async () => {
        await service.connectLocal();
        await service.disconnect();

        expect((service as any).localClient).toBeNull();
        expect((service as any).localTransport).toBeNull();
        expect((service as any).harnessClient).toBeNull();
        expect((service as any).harnessTransport).toBeNull();
    });

    it('should throw an error when calling tool without connecting', async () => {
        await expect(service.executeTool('test_tool', {})).rejects.toThrow('MCP Client (local) is not connected for tool: test_tool');
    });

    it('should call an MCP tool successfully', async () => {
        await service.connectLocal();

        const response = await service.executeTool('test_tool', { arg: 'value' });

        expect(response.content[0].text).toBe('mocked response');
    });
});
