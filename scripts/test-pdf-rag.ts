import * as dotenv from 'dotenv';
dotenv.config();

const { GeminiRetrieval } = await import('../src/services/rag/GeminiRetrievalService.ts');
import * as fs from 'fs';
import * as path from 'path';

async function testPdfRag() {
    console.log("🧪 Testing Native PDF RAG (Binary Ingestion)...");

    const service = GeminiRetrieval;
    const timestamp = Date.now();
    const pdfPath = path.join(process.cwd(), 'node_modules/@doyensec/electronegativity/docs/manuals/ElectronegativityUserManual_v1.4.0.pdf');

    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ Sample PDF not found at ${pdfPath}. Please ensure a test PDF exists.`);
        return;
    }

    try {
        console.log("1. Reading PDF binary...");
        const pdfBuffer = fs.readFileSync(pdfPath);

        console.log("2. Uploading PDF to Gemini Files API...");
        const file = await service.uploadFile(`Test_Plan_${timestamp}.pdf`, pdfBuffer);
        console.log(`   ✅ PDF uploaded. URI: ${file.uri}`);

        console.log("3. Ensuring FileSearchStore and Importing...");
        const storeName = await service.ensureFileSearchStore();
        await service.importFileToStore(file.name, storeName);
        console.log(`   ✅ PDF imported to store: ${storeName}`);

        console.log("4. Querying specifically against the PDF...");
        const query = "What is the primary executive summary goal mentioned in this business plan?";
        const result = await service.query(file.name, query, undefined, 'gemini-3-pro-preview');

        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("   🤖 Response:", answer);

        if (answer && answer.length > 20) {
            console.log("   ✅ SUCCESS: Native PDF RAG verified!");
        } else {
            console.error("   ❌ FAILURE: Response too short or empty.");
        }

        console.log("5. Cleaning up...");
        await service.deleteFile(file.name);
        console.log("   ✅ Cleaned up.");

    } catch (error: any) {
        console.error("❌ Test failed:", error.message || error);
    }
}

testPdfRag();
