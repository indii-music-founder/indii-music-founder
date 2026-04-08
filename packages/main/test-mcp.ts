import { mcpClientService } from './src/services/mcp/MCPClientService';

async function runTest() {
    console.log('Testing MCP Client connection...');
    try {
        await mcpClientService.connect();
        console.log('Connected!');

        console.log('Calling read_wav_tags with missing file...');
        const result = await mcpClientService.callTool('read_wav_tags', { filePath: '/does/not/exist.wav' });
        console.log('Tool Result:', JSON.stringify(result, null, 2));

        await mcpClientService.disconnect();
        console.log('Test completed successfully.');
    } catch (e: unknown) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

runTest();
