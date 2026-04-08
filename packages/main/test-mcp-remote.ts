import { mcpClientService } from './src/services/mcp/MCPClientService';

async function run() {
    try {
        console.log('Connecting to remote MCP...');
        // Using the standalone express server for testing
        // /sse
        await mcpClientService.connectRemote('http://127.0.0.1:3001/sse');

        console.log('Executing format_dsp_metadata tool...');
        const result = await mcpClientService.executeTool('format_dsp_metadata', {
            releaseTitle: 'Neon Nights',
            artists: ['Synthwave Guy', 'DJ Retro'],
            genre: 'Electronic'
        });

        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Test failed:', e);
        process.exitCode = 1;
    } finally {
        await mcpClientService.disconnect();
    }
}

run();
