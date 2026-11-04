import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/utils/logger';
import { mcpClientService } from './McpClientService';

describe('McpClientService diagnostics', () => {
    afterEach(() => {
        Reflect.set(mcpClientService, 'client', null);
        vi.restoreAllMocks();
    });

    it('passes arguments and results through without logging their contents', async () => {
        const secret = 'private-mcp-value-do-not-log';
        const callTool = vi.fn().mockResolvedValue({ content: [{ text: secret }] });
        Reflect.set(mcpClientService, 'client', { callTool });
        vi.spyOn(mcpClientService, 'connect').mockResolvedValue();
        const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});

        const result = await mcpClientService.executeTool('generate_playlist_pitch', { token: secret });

        expect(callTool).toHaveBeenCalledWith({ name: 'generate_playlist_pitch', arguments: { token: secret } });
        expect(result).toEqual({ content: [{ text: secret }] });
        expect(JSON.stringify(debug.mock.calls)).not.toContain(secret);
    });

    it('does not log an upstream error message that may contain tool data', async () => {
        const secret = 'private-mcp-error-do-not-log';
        Reflect.set(mcpClientService, 'client', { callTool: vi.fn().mockRejectedValue(new Error(secret)) });
        vi.spyOn(mcpClientService, 'connect').mockResolvedValue();
        const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

        await expect(mcpClientService.executeTool('generate_playlist_pitch', { token: secret })).rejects.toThrow(secret);

        expect(JSON.stringify(error.mock.calls)).not.toContain(secret);
    });
});
