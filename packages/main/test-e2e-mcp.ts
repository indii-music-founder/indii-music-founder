import { mcpClientService } from './src/services/mcp/MCPClientService';
import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

async function runE2ETest() {
    console.log('--- indii MCP E2E Test ---');
    try {
        console.log('\n1. Connecting Local MCP...');
        await mcpClientService.connectLocal();
        console.log('✅ Local MCP Connected');

        console.log('\n2. Connecting Remote MCP...');
        await mcpClientService.connectRemote('http://127.0.0.1:3001/sse');
        console.log('✅ Remote MCP Connected');

        console.log('\n3. Testing Remote Tool: format_dsp_metadata');
        const remoteResult = await mcpClientService.executeTool('format_dsp_metadata', {
            releaseTitle: 'E2E Test Single',
            artists: ['indii Automated Tester'],
            genre: 'Testing'
        });
        console.log('✅ Remote Tool Result:', JSON.stringify(remoteResult, null, 2));

        console.log('\n4. Testing Local Tool: read_pdf_contracts');
        const dummyPath = path.resolve(__dirname, 'dummy_test.pdf');
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        doc.text('E2E PDF Contract', 72, 72);
        doc.text('This file is a real PDF for parser verification.', 72, 96);
        fs.writeFileSync(dummyPath, Buffer.from(doc.output('arraybuffer')));

        const pdfResult = await mcpClientService.executeTool('read_pdf_contracts', { filePath: dummyPath });
        console.log('✅ Local Tool Result:', JSON.stringify(pdfResult, null, 2));

        if (fs.existsSync(dummyPath)) fs.unlinkSync(dummyPath);

        console.log('\n🎉 ALL TESTS PASSED!');
    } catch (e) {
        console.error('\n❌ E2E TEST FAILED:', e);
        process.exitCode = 1;
    } finally {
        await mcpClientService.disconnect();
    }
}

runE2ETest();
