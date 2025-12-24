
import * as dotenv from 'dotenv';
dotenv.config();

// Mock Proxy URL if missing for test
if (!process.env.VITE_FUNCTIONS_URL) {
    process.env.VITE_FUNCTIONS_URL = 'https://us-central1-indiios-v-1-1.cloudfunctions.net';
    console.log("⚠️ VITE_FUNCTIONS_URL missing, using live: https://us-central1-indiios-v-1-1.cloudfunctions.net");
}

const { GeminiRetrievalService } = await import('../src/services/rag/GeminiRetrievalService.ts');

async function runTest() {
    console.log("🧪 Starting Native RAG Verification (fileData support)...");

    const apiKey = process.env.VITE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
        console.error("❌ Missing API Key in .env");
        return;
    }

    // Explicitly pass API key if needed by the service constructor, 
    // though the service usually checks env.apiKey too.
    const service = new GeminiRetrievalService(apiKey);

    const testFileName = `Native_RAG_Test_${Date.now()}.txt`;
    const testContent = `
    CONFIDENTIAL PROJECT PROTOCOL: PROJECT TITAN
    
    1. OBJECTIVE: 
    The objective of Project Titan is to build a self-replicating AI music studio.
    
    2. CODENAME:
    The access code is "VELOCITY-9".
    
    3. KEY PERSONNEL:
    - Director: Sarah Conner
    - Lead Engineer: Miles Dyson
    `;

    console.log(`1. Uploading test file: ${testFileName}`);
    let file;

    try {
        file = await service.uploadFile(testFileName, testContent);
        console.log(`   ✅ Uploaded. URI: ${file.uri}`);
        console.log(`   State: ${file.state}`); // Should be ACTIVE or PROCESSING

        // Wait for ACTIVE if not already
        if (file.state === 'PROCESSING') {
            console.log("   Waiting for processing...");
            await service.waitForActive(file.name);
            console.log("   ✅ File is ACTIVE.");
        }

    } catch (e: any) {
        console.error("❌ Upload failed:", e.message);
        return;
    }

    console.log("2. Querying WITHOUT inline context (Native Mode)...");
    const query = "What is the access code for Project Titan?";

    try {
        // Pass 'testContent' to use Inline Fallback (Native RAG confirmed broken on Preview)
        console.log(`   👉 Using NATIVE RAG (File ID Only) with gemini-3-pro-preview`);
        // We pass undefined for content to force native path, and explicitly ask for PRO model
        // We pass undefined for content to force native path
        // Using approved gemini-3-pro-preview as the primary RAG target
        console.log(`   👉 Using NATIVE RAG with gemini-3-pro-preview (Temperature 0.0)`);
        const result = await service.query(file.name, query, undefined, 'gemini-3-pro-preview');
        console.log("   ✅ Query successful with gemini-3-pro-preview");
        console.log("   🤖 Response:", result.candidates?.[0]?.content?.parts?.[0]?.text || result);

        const candidate = data.candidates?.[0];
        const answer = candidate?.content?.parts?.[0]?.text;

        if (answer && answer.includes("VELOCITY-9")) {
            console.log("   ✅ SUCCESS: Retrieved correct answer via Native RAG.");
            console.log(`   Answer: "${answer.trim()}"`);
        } else {
            console.error("   ❌ FAILURE: Did not retrieve correct answer or answer is missing.");
            console.log("   Full Response:", JSON.stringify(data, null, 2));
        }

    } catch (e: any) {
        console.error("❌ Query failed:", e.message);
    } finally {
        console.log("3. Cleaning up...");
        try {
            await service.deleteFile(file.name);
            console.log("   ✅ File deleted.");
        } catch (cleanupErr) {
            console.error("   ⚠️ Cleanup failed:", cleanupErr);
        }
    }
}

runTest();
