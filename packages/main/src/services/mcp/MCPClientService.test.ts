import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'node:url';

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
        getPath: (name: string) => path.join(tmpdir(), `indii-component-${name}`),
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('MCPClientService', () => {
    let service: InstanceType<typeof import('./MCPClientService').MCPClientService>;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = mkdtempSync(path.join(tmpdir(), 'indii-mcp-test-'));
        const localServerPath = path.join(tempDir, 'local-index.js');
        const harnessServerPath = path.join(tempDir, 'harness-index.js');
        // Real SDK servers over child stdio; this probes protocol wiring only.
        const sdk = (entry: string) => JSON.stringify(pathToFileURL(require.resolve(entry)).href);
        const source = `
          const { Server } = await import(${sdk('@modelcontextprotocol/sdk/server/index.js')});
          const { StdioServerTransport } = await import(${sdk('@modelcontextprotocol/sdk/server/stdio.js')});
          const { CallToolRequestSchema, ListToolsRequestSchema } = await import(${sdk('@modelcontextprotocol/sdk/types.js')});
          const server = new Server({name:'roots-protocol-check',version:'1'}, {capabilities:{tools:{}}});
          server.setRequestHandler(ListToolsRequestSchema, async()=>({tools:[]}));
          server.setRequestHandler(CallToolRequestSchema, async()=>({content:[{type:'text',text:JSON.stringify(await server.listRoots())}]}));
          await server.connect(new StdioServerTransport());
        `;
        writeFileSync(localServerPath, `(async()=>{${source}})().catch(()=>process.exit(1));`);
        writeFileSync(harnessServerPath, `(async()=>{${source}})().catch(()=>process.exit(1));`);
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
        expect(await service.connectLocal()).toBe(true);
    });

    it('should skip local connection when the MCP server build is missing', async () => {
        process.env.INDII_LOCAL_MCP_SERVER_PATH = path.join(tempDir, 'missing-local-index.js');

        const connected = await service.connectLocal();

        expect(connected).toBe(false);

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

        const result = JSON.parse(response.content[0].text);
        expect(result.roots.some((root: { uri: string }) => root.uri === pathToFileURL(realpathSync(tmpdir())).href)).toBe(true);
    });

    it('resets local and harness client on transport close and reconnects on subsequent connect call', async () => {
        expect(await service.connectLocal()).toBe(true);

        const localTransport = (service as any).localTransport;
        const harnessTransport = (service as any).harnessTransport;

        expect(localTransport).toBeDefined();
        expect((service as any).localClient).toBeDefined();

        // Simulate transport closing unexpectedly (e.g. child process exit)
        localTransport.onclose?.();

        expect((service as any).localClient).toBeNull();
        expect((service as any).localTransport).toBeNull();

        if (harnessTransport) {
            harnessTransport.onclose?.();
            expect((service as any).harnessClient).toBeNull();
            expect((service as any).harnessTransport).toBeNull();
        }

        // Reconnection succeeds because client state was reset cleanly
        expect(await service.connectLocal()).toBe(true);
        expect((service as any).localClient).toBeDefined();
    });
});
