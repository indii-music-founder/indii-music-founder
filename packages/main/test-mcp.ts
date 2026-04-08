import { mcpClientService } from './src/services/mcp/MCPClientService';

async function runTest() {
    console.log('Testing MCP Client connection...');
    try {
        await mcpClientService.connectLocal();
        console.log('Connected!');

        console.log('Calling read_wav_tags with missing file (expecting error)...');
        try {
            await mcpClientService.executeTool('read_wav_tags', { filePath: '/does/not/exist.wav' });
        } catch (err: unknown) {
            console.log('✅ Correctly caught expected MCP Error from local server:', (err as Error).message);
        }

        await mcpClientService.disconnect();
        console.log('✅ Phase 1 Local MCP Test completed successfully.');
    } catch (e: unknown) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
