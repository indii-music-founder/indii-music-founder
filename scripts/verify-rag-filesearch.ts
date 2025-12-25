import * as dotenv from 'dotenv';
dotenv.config();

// Mock Proxy URL if missing for test
if (!process.env.VITE_FUNCTIONS_URL) {
    process.env.VITE_FUNCTIONS_URL = 'https://us-central1-indiios-v-1-1.cloudfunctions.net';
    console.log("⚠️ VITE_FUNCTIONS_URL missing, using live: https://us-central1-indiios-v-1-1.cloudfunctions.net");
}

const { GeminiRetrieval } = await import('../src/services/rag/GeminiRetrievalService.ts');

async function runVerification() {
    console.log("🧪 Starting Multi-File RAG Stress Test (File Search Tool)...");

    const service = GeminiRetrieval;
    const timestamp = Date.now();

    // 1. Prepare two different context files
    const file1Content = `
        DOCUMENT ID: DOC-ALPHA
        TOPIC: Personnel Records
        John Doe is the Head of Security.
        His emergency contact is Jane Smith at 555-0199.
        Security Clearance: LEVEL 5.
    `;

    const file2Content = `
        DOCUMENT ID: DOC-BETA
        TOPIC: Technical Specifications
        The Main Reactor operates at 42,000 RPM.
        Optimal temperature is 1,200 Kelvin.
        Maintenance is performed by the Droid Team (Lead: R2-D2).
    `;

    try {
        // Step 1: Upload both files
        console.log("1. Uploading test files...");
        const fileA = await service.uploadFile(`StressTest_Alpha_${timestamp}.txt`, file1Content);
        const fileB = await service.uploadFile(`StressTest_Beta_${timestamp}.txt`, file2Content);
        console.log(`   ✅ Files uploaded. URIs: ${fileA.uri}, ${fileB.uri}`);

        // Step 2: Ensure store and import
        console.log("2. Linking files to FileSearchStore...");
        const storeName = await service.ensureFileSearchStore();
        await service.importFileToStore(fileA.name, storeName);
        await service.importFileToStore(fileB.name, storeName);
        console.log(`   ✅ Both files imported to ${storeName}.`);

        // Step 3: Synthesis Query
        const query = "Who is the lead technician for reactor maintenance, and what is the emergency contact phone number for the security head?";
        console.log(`3. Querying with synthesis (Store-wide): "${query}"`);

        const result = await service.query(null, query, undefined, 'gemini-3-pro-preview');
        console.log("   ✅ Query successful.");

        const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("   🤖 Response:", answer);

        if (answer && answer.includes("R2-D2") && answer.includes("555-0199")) {
            console.log("   ✅ SUCCESS: Synthesis across multiple files verified!");
        } else {
            console.error("   ❌ FAILURE: Response missing key information from both files.");
        }

        // 4. Cleanup
        console.log("4. Cleaning up...");
        await service.deleteFile(fileA.name);
        await service.deleteFile(fileB.name);
        console.log("   ✅ Files deleted.");

    } catch (error: any) {
        console.error("❌ Test failed:", error.message || error);
        process.exit(1);
    }
}

runVerification();
