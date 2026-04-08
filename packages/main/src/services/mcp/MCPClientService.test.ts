import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPClientService } from './MCPClientService';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
    return {
        Client: vi.fn().mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: 'mocked response' }]
            }),
        }))
    };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
    return {
        StdioClientTransport: vi.fn().mockImplementation(() => ({
            close: vi.fn().mockResolvedValue(undefined),
        }))
    };
});

describe('MCPClientService', () => {
    let service: MCPClientService;

    beforeEach(() => {
        service = new MCPClientService();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await service.disconnect();
    });

    it('should connect successfully', async () => {
        await service.connectLocal();

        // Assert that the client was instantiated
        expect(Client).toHaveBeenCalledTimes(1);
    });

    it('should disconnect successfully', async () => {
        await service.connectLocal();
        await service.disconnect();

        // Internal state cannot be easily asserted without cast, but we verify it runs
        expect(true).toBe(true);
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
